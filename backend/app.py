import os
import json
from dotenv import load_dotenv

# Load environment variables on app startup
load_dotenv()

from flask import Flask
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore

app = Flask(__name__)
# Enable CORS globally for all endpoints so that the React client and Express proxy communicate seamlessly
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Global database client initialized securely
db = None

# Extract credentials details directly from the user's config
config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'firebase-applet-config.json')
if not os.path.exists(config_path):
    config_path = 'firebase-applet-config.json'

project_id = None
database_id = None

if os.path.exists(config_path):
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
            project_id = config.get('projectId')
            database_id = config.get('firestoreDatabaseId')
            print(f"Loaded config: ProjectID={project_id}, DatabaseID={database_id}")
    except Exception as e:
        print("Error reading firebase-applet-config.json:", e)

try:
    if not firebase_admin._apps:
        if project_id:
            os.environ['GOOGLE_CLOUD_PROJECT'] = project_id
        firebase_admin.initialize_app()
    
    if database_id:
        try:
            db = firestore.client(database_id=database_id)
        except Exception as e:
            print(f"Specific database initialization failed: {e}. Falling back to default.")
            db = firestore.client()
    else:
        db = firestore.client()
        
    print("Database connection successfully established with Firestore.")
except Exception as e:
    print("Warning: Firestore client connection failed. Operating in Local Memory Mode:", e)
    db = None

# Register blueprint APIs under the standard /api prefix
from backend.routes import api_bp
app.register_blueprint(api_bp, url_prefix='/api')

@app.route('/health')
def health():
    return {"status": "healthy", "service": "DiaCare AI Flask Backend", "firestore": db is not None}

if __name__ == '__main__':
    # Running locally inside container on port 5000 (Express running on port 3000 proxies all /api entries)
    port = int(os.environ.get('FLASK_PORT', 5000))
    print(f"Flask application starting on host 0.0.0.0, port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
