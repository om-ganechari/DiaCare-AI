import os
import random
import string
import base64
import datetime
from flask import Blueprint, request, jsonify
from google import genai
from google.genai import types
from backend.pdf_generator import generate_pdf_report
from backend.mailer import send_assessment_email

api_bp = Blueprint('api', __name__)

# Heuristic calculations identical to Express server logic
fallbacks = {
    'en': {
        'lowRisk': "Based on your symptoms and metrics, your diabetes risk profile is currently Low. Maintain your balanced physical activities and healthy diet.",
        'modRisk': "Your profile indicates a Moderate Risk. Some key indicators like body mass metrics, high junk food frequency, or family history may be drivers. We recommend booking a medical screening soon.",
        'highRisk': "Your risk profile is High. Multi-symptom indicators like excessive thirst, frequent fatigue, and body index parameters require close professional review. Clinical validation is strongly recommended.",
        'recFasting': "Fasting Blood Sugar Test: Standard metric measuring glucose after 8+ hour fasting.",
        'recHba1c': "HbA1c Test: Measures your average blood sugar levels over the past 3 months.",
        'recRandom': "Random Blood Sugar Test: Measures blood glucose at any given point during the day.",
        'dietTip': "Diet: Restrict intake of high glycemic index carbohydrates, refined sugars, and processed fats. Consume rich dietary fibers.",
        'exerciseTip': "Active Routine: Engage in 30+ minutes of brisk cardiovascular walking or structured exercise at least 5 days a week.",
        'waterTip': "Hydration: Aim to drink 2.5 to 3 liters of fresh water daily.",
        'sleepTip': "Sleep Hygiene: Maintain a regular sleep schedule of 7 to 8 hours of restorative sleep.",
        'stressTip': "Stress Control: Adopt simple mind-body decompression habits such as deep-breathing cycles, twice daily."
    },
    'hi': {
        'lowRisk': "आपके लक्षणों और पैमानों के आधार पर, आपके मधुमेह का जोखिम वर्तमान में कम (Low) है। अपनी शारीरिक गतिविधियों और स्वस्थ आहार को जारी रखें।",
        'modRisk': "आपका जोखिम मध्यम (Moderate) स्तर पर है। शरीर के वजन, जंक फूड के सेवन या पारिवारिक इतिहास जैसे कुछ कारक इसके कारण हो सकते हैं। हम जल्द ही चिकित्सा जांच की सलाह देते हैं।",
        'highRisk': "आपका जोखिम जोखिम उच्च (High) है। अत्यधिक प्यास लगना, बार-बार थकान और शारीरिक सूचकांक जैसे कई लक्षण महत्वपूर्ण समीक्षा की मांग करते हैं। नैदानिक मूल्यांकन की अत्यधिक अनुशंसा की जाती है।",
        'recFasting': "फास्टिंग ब्लड शुगर टेस्ट (न्यूनतम 8 घंटे के उपवास के बाद शर्करा की जांच)।",
        'recHba1c': "HbA1c टेस्ट (पिछले 3 महीनों में औसत रक्त शर्करा के स्तर का नैदानिक आकलन)।",
        'recRandom': "रैंडम ब्लड शुगर टेस्ट (दिन में किसी भी समय अचानक रक्त शर्करा स्तर की जांच)।",
        'dietTip': "आहार: रिफाइंड शुगर, मैदा और प्रोसेस्ड खाद्य पदार्थों से सख्ती से बचें। रेशेदार (फाइबर) सब्जियों व साबुत अनाज का सेवन बढ़ाएं।",
        'exerciseTip': "व्यायाम: सप्ताह में कम से कम 5 दिन 30 मिनट तेज गति से पैदल चलें या अन्य एरोबिक व्यायाम करें।",
        'waterTip': "जल उपभोग: प्रतिदिन 2.5 से 3 लीटर ताज़ा और शुद्ध पानी पीना सुनिश्चित करें।",
        'sleepTip': "नींद: समय पर सोएं और 7-8 घंटे की गहरी सुखद नींद लें।",
        'stressTip': "तनाव प्रबंधन: दिन में दो बार गहरी सांस लेने के चक्र जैसी तनाव को नियंत्रित करने वाली आदतें अपनाएं।"
    },
    'mr': {
        'lowRisk': "तुमच्या लक्षणांच्या आणि शरीराच्या स्थितीच्या आधारे, तुमच्या मधुमेहाचा धोका सध्या कमी (Low) आहे. संतुलित आहार आणि नियमित व्यायाम सुरू ठेवा.",
        'modRisk': "तुमच्या आरोग्याची स्थिती मध्यम धोका (Moderate Risk) दर्शवत आहे. अतिरिक्त जंक फूडचे सेवन, उंची-वजनाचे विषम प्रमाण किंवा कौटुंबिक इतिहास कारणीभूत असू शकतात. तज्ज्ञांकडून नियमित तपासणी करून घ्या.",
        'highRisk': "तुमचा मधुमेहाचा धोका जास्त (High) आहे. सतत तहान लागणे, थकवा आणि शरीराचे प्रमाण यांसारख्या लक्षणाकडे दुर्लक्ष करू नका. त्वरित वैद्यकीय सल्ला आणि चाचण्या घेण्याची अत्यंत गरज आहे.",
        'recFasting': "फास्टिंग ब्लड शुगर टेस्ट: ८ तासांच्या उपवासानंतर केली जाणारी साखरेची प्राथमिक चाचणी.",
        'recHba1c': "HbA1c टेस्ट: गेल्या ३ महिन्यांतील तुमच्या रक्तातील ग्लुकोजची सरासरी प्रमाण दर्शवणारी विश्वसनीय चाचणी.",
        'recRandom': "रँडम ब्लड शुगर टेस्ट: दिवसाच्या कोणत्याही वेळी साखरेची पातळी मोजण्यासाठी केली जाणारी चाचणी.",
        'dietTip': "आहार: मैदा, गोड आणि प्रक्रिया केलेले पदार्थ पूर्णपणे टाळा. आहारात हिरव्या पालेभाज्या व फायबरयुक्त धान्याचा समावेश करा.",
        'exerciseTip': "नियमित हालचाल: आठवड्यातून किमान ५ दिवस दिवसाला ३० मिनिटे वेगाने चालणे किंवा व्यायाम करणे सुरू करा.",
        'waterTip': "पाणी पिणे: दिवसाभरात २.५ ते ३ लीटर ताजे पाणी पिण्याचे उद्दिष्ट ठेवा.",
        'sleepTip': "शांत झोप: रोज रात्री ७ ते ८ तासांची पुरेशी आणि नियमित झोप घ्या.",
        'stressTip': "मानसिक आरोग्य: ताणतणाव कमी करण्यासाठी दररोज किमान दोन वेळा प्राणायाम किंवा श्वसनाचे सोपे व्यायाम करा।"
    }
}

def calculate_risk_level(body):
    age = body.get('age', 35)
    gender = body.get('gender', 'male')
    height = body.get('height', 170)
    weight = body.get('weight', 75)
    symptoms = body.get('symptoms', {})
    lifestyle = body.get('lifestyle', {})
    
    risk_percent = 10
    
    # Age rating
    if age > 20:
        risk_percent += min(25, int((age - 20) * 0.5))
        
    # BMI calculation
    height_m = height / 100.0
    bmi = weight / (height_m * height_m) if height_m > 0 else 22.0
    
    if bmi > 25:
        risk_percent += 15
    if bmi > 30:
        risk_percent += 15
        
    # Family history
    if lifestyle.get('familyHistory'):
        risk_percent += 20
        
    # Symptom levels
    smp_weights = {
        'frequentUrination': 8, 'excessiveThirst': 8, 'extremeHunger': 5,
        'constantFatigue': 5, 'blurredVision': 4, 'slowHealing': 6,
        'tinglingHandsFeet': 4, 'frequentInfections': 4, 'dryMouth': 3,
        'suddenWeightChange': 6, 'headaches': 3, 'dizziness': 3
    }
    for symptom, weight_val in smp_weights.items():
        if symptoms.get(symptom):
            risk_percent += weight_val
            
    # Lifestyle triggers
    if lifestyle.get('activityLevel') == 'low':
        risk_percent += 10
    elif lifestyle.get('activityLevel') == 'active':
        risk_percent -= 5
        
    if lifestyle.get('junkFoodFreq') == 'frequent':
        risk_percent += 10
    elif lifestyle.get('junkFoodFreq') == 'sometimes':
        risk_percent += 3
        
    if lifestyle.get('sugarIntake') == 'high':
        risk_percent += 12
    elif lifestyle.get('sugarIntake') == 'moderate':
        risk_percent += 4
    elif lifestyle.get('sugarIntake') == 'low':
        risk_percent -= 4
        
    if int(lifestyle.get('sleepHours', 7) or 7) < 6:
        risk_percent += 6
    elif int(lifestyle.get('sleepHours', 7) or 7) > 9:
        risk_percent += 2
        
    if lifestyle.get('stressLevel') == 'high':
        risk_percent += 8
    elif lifestyle.get('stressLevel') == 'medium':
        risk_percent += 3
        
    if lifestyle.get('smoking'):
        risk_percent += 6
        
    if lifestyle.get('alcohol') == 'regular':
        risk_percent += 8
    elif lifestyle.get('alcohol') == 'occasional':
        risk_percent += 2
        
    risk_percent = max(5, min(98, risk_percent))
    health_score = max(10, min(99, 100 - max(0, risk_percent - 5)))
    
    risk_level = 'low'
    if risk_percent >= 70:
        risk_level = 'high'
    elif risk_percent >= 35:
        risk_level = 'moderate'
        
    return bmi, risk_percent, health_score, risk_level


# Initialize standard Google GenAI Client
def get_gemini_client():
    api_key = os.environ.get('GEMINI_API_KEY')
    if api_key and api_key != 'MY_GEMINI_API_KEY':
        try:
            # Construct client with the explicit user header requirement
            return genai.Client(api_key=api_key, http_options={"headers": {"User-Agent": "aistudio-build"}})
        except Exception as e:
            print("Gemini client initialization failed in routes.py:", e)
    return None


@api_bp.route('/analyze', methods=['POST'])
def analyze():
    from backend.app import db
    try:
        body = request.get_json() or {}
        age = body.get('age', 35)
        gender = body.get('gender', 'male')
        height = body.get('height', 170)
        weight = body.get('weight', 75)
        symptoms = body.get('symptoms', {})
        lifestyle = body.get('lifestyle', {})
        lang = body.get('lang', 'en')
        
        l = lang if lang in ['en', 'hi', 'mr'] else 'en'
        
        # Calculate Risk Levels
        bmi, risk_percent, health_score, risk_level = calculate_risk_level(body)
        
        # Pull text templates from fallbacks
        explanation = fallbacks[l][f'{risk_level}Risk']
        recommendations = [
            fallbacks[l]['dietTip'],
            fallbacks[l]['exerciseTip'],
            fallbacks[l]['waterTip'],
            fallbacks[l]['sleepTip'],
            fallbacks[l]['stressTip']
        ]
        
        if risk_level != 'low':
            recommendations.insert(0, fallbacks[l]['recRandom'])
            recommendations.insert(0, fallbacks[l]['recHba1c'])
            recommendations.insert(0, fallbacks[l]['recFasting'])
            
        ai_client = get_gemini_client()
        if ai_client:
            symptom_list = ", ".join([k for k, v in symptoms.items() if v]) or 'None'
            sys_inst = (
                "You are a professional endocrinologist health risk analyzer. "
                "Provide concise, clear, patiently supportive explanations. No HTML/code. "
                "Structure into 'EXPLANATION:' and 'RECOMMENDATIONS:' sections."
            )
            prompt = (
                f"Perform a smart medical risk screening.\n"
                f"Language: {l}\n"
                f"Patient Details: Age {age}, Gender {gender}, Height {height}cm, Weight {weight}kg, BMI {bmi:.1f}.\n"
                f"Symptoms: {symptom_list}.\n"
                f"Lifestyle: Activity={lifestyle.get('activityLevel')}, Sleep={lifestyle.get('sleepHours')}, "
                f"Stress={lifestyle.get('stressLevel')}, Sugar={lifestyle.get('sugarIntake')}, Family History={lifestyle.get('familyHistory')}.\n"
                f"Diagnostic score: {risk_percent}% ({risk_level}).\n\n"
                f"Generate formatted EXPLANATION: and RECOMMENDATIONS: output in requested language."
            )
            try:
                # Basic Text Task choosing gemini-3.5-flash as specified by SKILL.md
                response = ai_client.models.generate_content(
                    model='gemini-3.5-flash',
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=sys_inst
                    )
                )
                text_out = response.text or ""
                if "EXPLANATION:" in text_out and "RECOMMENDATIONS:" in text_out:
                    parts = text_out.split("RECOMMENDATIONS:")
                    final_exp = parts[0].replace("EXPLANATION:", "").strip()
                    final_recs = [line.strip().replace("-", "").replace("*", "").replace("•", "").strip() 
                                  for line in parts[1].split("\n") if line.strip()]
                    
                    if len(final_exp) > 20:
                        explanation = final_exp
                    if len(final_recs) > 1:
                        recommendations = final_recs
                elif len(text_out) > 30:
                    explanation = text_out
            except Exception as e:
                print("Gemini analyze failed, operating heuristic:", e)
                
        assessment_id = 'dia_' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))
        assessment = {
            'assessmentId': assessment_id,
            'userId': body.get('userId', 'anonymous'),
            'metrics': {'age': age, 'gender': gender, 'height': height, 'weight': weight, 'bmi': round(bmi, 1)},
            'symptoms': symptoms,
            'lifestyle': lifestyle,
            'riskLevel': risk_level,
            'riskPercentage': risk_percent,
            'healthScore': health_score,
            'explanation': explanation,
            'recommendations': recommendations,
            'clinicallyPredicted': False,
            'createdAt': datetime.datetime.now().isoformat()
        }
        
        # Save to Firestore if available
        if db:
            try:
                db.collection('assessments').document(assessment_id).set(assessment)
            except Exception as fs_err:
                print("Failed to save to Firestore assessments collection:", fs_err)
                
        return jsonify(assessment)
    except Exception as e:
        print("Diagnostic exception:", e)
        return jsonify({'error': str(e)}), 500


@api_bp.route('/clinical-predict', methods=['POST'])
def clinical_predict():
    from backend.app import db
    try:
        body = request.get_json() or {}
        glucose = body.get('glucose', 100)
        blood_pressure = body.get('bloodPressure', 120)
        insulin = body.get('insulin', 15)
        hba1c = body.get('hba1c', 5.8)
        cholesterol = body.get('cholesterol', 185)
        bmi = body.get('bmi', 22.0)
        prev_assessment = body.get('previousAssessment')
        lang = body.get('lang', 'en')
        
        l = lang if lang in ['en', 'hi', 'mr'] else 'en'
        base_risk = prev_assessment.get('riskPercentage', 50) if prev_assessment else 50
        calibrated_risk = base_risk
        alerts = []
        
        # Direct physiological risk logic
        if glucose >= 200:
            calibrated_risk = max(calibrated_risk, 85) + 12
            alerts.append("Severely Elevated Glucose Level (Diabetic range)" if l == 'en' 
                          else "अत्यधिक उच्च ग्लूकोज स्तर (मधुमेह सीमा)" if l == 'hi' 
                          else "अत्यंत रक्तातील ग्लुकोज पातळी वाढली (मधुमेह श्रेणी)")
        elif glucose >= 140:
            calibrated_risk = max(calibrated_risk, 60) + 7
            alerts.append("Elevated Blood Glucose (Prediabetes range)" if l == 'en' 
                          else "ग्लूकोज स्तर सामान्य से अधिक (प्री-डायबिटीज)" if l == 'hi' 
                          else "ग्लुकोज पातळी वाढलेली (पूर्व मधुमेह)")
        elif glucose < 70:
            alerts.append("Caution: Potential Hypoglycemia level" if l == 'en' 
                          else "सावधान: निम्न ग्लूकोज सीमा (हाइपोग्लाइसीमिया)" if l == 'hi' 
                          else "सावधान: ग्लुकोज पातळी कमी (हायपोग्लायसेमिया)")
            
        if blood_pressure >= 140:
            calibrated_risk += 8
            alerts.append("High Blood Pressure (Stage 2 Hypertension)" if l == 'en' 
                          else "उच्च रक्तचाप (द्वितीय चरण)" if l == 'hi' 
                          else "उच्च रक्तदाब (दुसरा टप्पा)")
        elif blood_pressure >= 135:
            calibrated_risk += 4
            
        if insulin >= 25:
            calibrated_risk += 10
            alerts.append("Elevated plasma insulin suggests insulin resistance" if l == 'en' 
                          else "इन्सुलिन प्रतिरोधक क्षमता के संकेत" if l == 'hi' 
                          else "इन्सुलिन प्रतिकार दर्शवणारी पातळी")
            
        if hba1c >= 6.5:
            calibrated_risk = max(calibrated_risk, 80) + 10
            alerts.append("HbA1c level represents Diabetic diagnostic threshold (>= 6.5%)" if l == 'en'
                          else "HbA1c स्तर मधुमेह दहलीज (>= 6.5%) को दर्शाता है" if l == 'hi'
                          else "HbA1c पातळी मधुमेहाची पातळी दर्शवते (>= ६.५%)")
        elif hba1c >= 5.7:
            calibrated_risk = max(calibrated_risk, 55) + 5
            alerts.append("HbA1c level represents Prediabetes range (5.7% - 6.4%)" if l == 'en'
                          else "HbA1c स्तर प्री-डायबिटीज (5.7% - 6.4%) को दर्शाता है" if l == 'hi'
                          else "HbA1c पातळी पूर्व-मधुमेह दर्शवते (५.७% - ६.४%)")

        if cholesterol >= 240:
            calibrated_risk += 6
            alerts.append("High Cholesterol level can compound cardiovascular risks" if l == 'en'
                          else "उच्च कोलेस्ट्रॉल का स्तर हृदय जोखिमों को बढ़ा सकता है" if l == 'hi'
                          else "कोलेस्टेरॉल पातळी वाढल्यामुळे हृदयविकाराची शक्यता वाढू शकते")
            
        if bmi >= 30:
            calibrated_risk += 8
            
        calibrated_risk = max(5, min(99, calibrated_risk))
        calibrated_score = max(10, min(99, 100 - max(0, calibrated_risk - 5)))
        
        risk_level = 'low'
        if calibrated_risk >= 75:
            risk_level = 'high'
        elif calibrated_risk >= 35:
            risk_level = 'moderate'
            
        prediction_text = (
            "Your clinical measurements indicate a resilient profile. Avoid excessive carbs and monitor glucose biannually." if l == 'en' 
            else "आपके नैदानिक आंकड़े सामान्य और सुरक्षित सीमा के भीतर हैं। कम कार्बोहाइड्रेट का सेवन जारी रखें।" if l == 'hi' 
            else "तुमची क्लिनिकल आकडेवारी सामान्य आहे. नियमित तपासणी करत रहा."
        )
        if risk_level == 'moderate':
            prediction_text = (
                "Your inputs represent moderate risk metabolic trends. Enhanced glucose and HbA1c tests must be consulted with a registered medical practitioner." if l == 'en' 
                else "आपका नैदानिक प्रोफाइल मध्यम चयापचय जोखिम को दर्शाता है। कृपया डॉक्टर से सलाह लेकर HbA1c जांच करवाएं।" if l == 'hi' 
                else "तुमची क्लिनिकल स्थिती मध्यम धोका दर्शवते. कृपया डॉक्टरांचा सल्ला घ्या."
            )
        elif risk_level == 'high':
            prediction_text = (
                "CRITICAL EVALUATION REQUIRED: Highly elevated blood glucose and secondary metric levels place you in a high-risk diabetes category. Clinical scheduling is urgently recommended." if l == 'en' 
                else "त्वरित चिकित्सा परामर्श आवश्यक: उच्च रक्त शर्करा स्तर आपको अत्यधिक जोखिम वाली श्रेणी में रखता है। अविलम्ब चिकित्सक से मिलें।" if l == 'hi' 
                else "तातडीचा वैद्यकीय सल्ला आवश्यक: रक्तातील वाढलेली साखरेची पातळी धोकादायक असून त्वरित तज्ज्ञ डॉक्टरांना दाखवावे."
            )
            
        suggestions = [
            "Consider consulting with a dietitian for low carb plans" if l == 'en' else "पोषण विशेषज्ञ से संपर्क करें" if l == 'hi' else "पथ्य तज्ज्ञांचा सल्ला घ्या",
            "Monitor daily liquid water intake" if l == 'en' else "नियमित पानी पिएं" if l == 'hi' else "पाणी पिण्याच्या प्रमाणावर लक्ष ठेवा",
            "Book HbA1c laboratory assessment" if l == 'en' else "HbA1c परीक्षण करवाएं" if l == 'hi' else "HbA1c चाचणी करून घ्या"
        ]
        
        ai_client = get_gemini_client()
        if ai_client:
            prompt = (
                f"Perform clinical evaluation.\n"
                f"Language: {l}\n"
                f"Lab readings: Glucose={glucose} mg/dL, Blood Pressure={blood_pressure} mmHg, Insulin={insulin} uIU/mL, BMI={bmi}.\n"
                f"Calculated mathematical rating: {calibrated_risk}% ({risk_level}).\n"
                f"Physiologic alerts: {'; '.join(alerts)}.\n\n"
                f"Generate medical summary and 3 suggestions starting with SUMMARY: and SUGGESTIONS: headers in {l}."
            )
            try:
                response = ai_client.models.generate_content(
                    model='gemini-3.5-flash',
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction="You are an AI-driven clinical Endocrinologist specialist adviser."
                    )
                )
                text_out = response.text or ""
                if "SUMMARY:" in text_out and "SUGGESTIONS:" in text_out:
                    parts = text_out.split("SUGGESTIONS:")
                    prediction_text = parts[0].replace("SUMMARY:", "").strip()
                    suggestions = [line.strip().replace("-", "").replace("*", "").replace("•", "").strip() 
                                   for line in parts[1].split("\n") if line.strip()]
                elif len(text_out) > 25:
                    prediction_text = text_out
            except Exception as e:
                print("Clinical AI predictions failed:", e)
                
        updated_id = prev_assessment.get('assessmentId') if prev_assessment else ('dia_' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=7)))
        updated_assessment = {
            'assessmentId': updated_id,
            'userId': prev_assessment.get('userId', 'anonymous') if prev_assessment else 'anonymous',
            'metrics': prev_assessment.get('metrics', {'age': 35, 'gender': 'male', 'height': 170, 'weight': 75, 'bmi': bmi}) if prev_assessment else {'age': 35, 'gender': 'male', 'height': 170, 'weight': 75, 'bmi': bmi},
            'symptoms': prev_assessment.get('symptoms', {}) if prev_assessment else {},
            'lifestyle': prev_assessment.get('lifestyle', {}) if prev_assessment else {},
            'clinicalData': {'glucose': glucose, 'bloodPressure': blood_pressure, 'insulin': insulin, 'hba1c': hba1c, 'cholesterol': cholesterol, 'bmi': bmi},
            'riskLevel': risk_level,
            'riskPercentage': calibrated_risk,
            'healthScore': calibrated_score,
            'explanation': prediction_text,
            'recommendations': suggestions,
            'clinicallyPredicted': True,
            'alerts': alerts,
            'createdAt': datetime.datetime.now().isoformat()
        }
        
        if db:
            try:
                db.collection('assessments').document(updated_id).set(updated_assessment)
            except Exception as fs_err:
                print("Failed to save to Firestore inside clinical-predict:", fs_err)
                
        return jsonify(updated_assessment)
    except Exception as e:
        print("Prediction module error:", e)
        return jsonify({'error': str(e)}), 500


@api_bp.route('/chat', methods=['POST'])
def chat():
    try:
        body = request.get_json() or {}
        message = body.get('message', '')
        history = body.get('history', [])
        lang = body.get('lang', 'en')
        l = lang if lang in ['en', 'hi', 'mr'] else 'en'
        
        reply_fallback = (
            "DiaCare AI Assistant is online. Answer our 'Start risk analysis' questions first! How can I guide you today?" if l == 'en' 
            else "डायकेयर एआई सहायक ऑनलाइन है। हमारा सुझाव है कि पहले हमारी 'जोखिम विश्लेषण' प्रश्नावली को हल करें!" if l == 'hi' 
            else "डियाकेअर एआय सहाय्यक सुरू आहे. आपण आधी आमचे 'जोखिम विश्लेषण' प्रश्न सोडवून घ्या!"
        )
        
        ai_client = get_gemini_client()
        if ai_client:
            try:
                # Compile conversational hist matching GoogleGenAI schema patterns
                formatted_contents = []
                for chat_turn in history[-6:]: # Limit history size for latency & limit parameters
                    role = 'user' if chat_turn.get('sender') == 'user' else 'model'
                    formatted_contents.append(
                        types.Content(role=role, parts=[types.Part.from_text(text=chat_turn.get('text', ''))])
                    )
                formatted_contents.append(
                    types.Content(role='user', parts=[types.Part.from_text(text=message)])
                )
                
                sys_inst = (
                    "You are the primary clinical intelligence engine for 'DiaCare AI'. "
                    "You specialize in Diabetes, diet glycemic index, routine exercise, hydration levels, and wellness tips. "
                    "Empathetic tone. Highlight that professional human physician checkups are essential. "
                    f"Write in language: {l}. Maximum 150 words."
                )
                response = ai_client.models.generate_content(
                    model='gemini-3.5-flash',
                    contents=formatted_contents,
                    config=types.GenerateContentConfig(
                        system_instruction=sys_inst
                    )
                )
                reply = response.text or reply_fallback
                return jsonify({'text': reply, 'timestamp': datetime.datetime.now().isoformat()})
            except Exception as e:
                print("Gemini conversational engine failed, running offline keyword checker:", e)
        
        # Keyword offline heuristics check matching previous node-heuristics
        lookup = message.lower()
        if 'food' in lookup or 'diet' in lookup or 'आहार' in lookup or 'खाद्य' in lookup or 'जेवण' in lookup:
            reply_fallback = (
                "🎯 Recommended diet principles:\n\n- Limit direct sweet items, cookies, sugar juices, and white flour.\n- Fuel daily routines with fiber, raw green vegetables.\n\n*Consult our certified nutritionist for personalized carbohydrate charts.*" if l == 'en'
                else "🎯 अनुशंसित आहार सूत्र:\n\n- सीधे मीठा, बिस्कुट, चीनी युक्त जूस और मैदे वाली चीजों से बचें।" if l == 'hi'
                else "🎯 आहारातील महत्त्वाची पथ्ये:\n\n- साखर, मिठाई, पॅक ज्युस आणि मैद्याचे पदार्थ खाणे टाळा."
            )
        elif 'how' in lookup or 'work' in lookup or 'कसे' in lookup or 'काम' in lookup or 'कैसे' in lookup:
            reply_fallback = (
                "🚀 To use DiaCare AI:\n\n1. Press 'Start Risk Assessment' in questionnaire form.\n2. Complete blood readings lab calibration if desired.\n3. Instantly download detailed PDF report cards!" if l == 'en'
                else "🚀 उपयोग विधि:\n\n1. प्रश्नावली हल करें।\n2. लैब आंकड़े भरें।\n3. स्वास्थ्य रिपोर्ट पीडीएफ डाउनलोड करें।" if l == 'hi'
                else "🚀 कसे वापरावे:\n\n1. जोखीम निदानावर प्रश्न सोडवा.\n2. आवश्यक असल्यास लॅब रिपोर्ट आकडे नोंदवा.\n3. लगेचच रिपोर्ट डाउनलोड करा."
            )
        return jsonify({'text': reply_fallback, 'timestamp': '2026-05-23T10:17:00Z'})
    except Exception as e:
        print("Chat exception:", e)
        return jsonify({'error': str(e)}), 500


@api_bp.route('/email-report', methods=['POST'])
def email_report():
    try:
        body = request.get_json() or {}
        email = body.get('email')
        assessment = body.get('assessment')
        
        if not email:
            return jsonify({'error': 'Valid target email is required'}), 400
            
        # 1. Generate local high-fidelity ReportLab PDF binary buffer
        pdf_buffer = generate_pdf_report(assessment)
        pdf_bytes = pdf_buffer.getvalue()
        
        # 2. Convert to Base64 to support download directly within the browser (Awesome Client UX!)
        pdf_b64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        # 3. Dispatch the report using SMTP/Simulated system
        status, courier_resp = send_assessment_email(email, assessment, pdf_buffer)
        
        return jsonify({
            'success': status,
            'message': f"Report successfully dispatched to {email}!",
            'preview': courier_resp,
            'pdfBase64': pdf_b64
        })
    except Exception as e:
        print("Mail proxy engine failure:", e)
        return jsonify({'error': str(e)}), 500


@api_bp.route('/feedback', methods=['POST'])
def feedback():
    from backend.app import db
    try:
        body = request.get_json() or {}
        rating = body.get('rating')
        comment = body.get('comment', '')
        name = body.get('name', 'Anonymous Seeker')
        email = body.get('email', '')
        
        if rating is None:
            return jsonify({'error': 'Missing rating scores'}), 400
            
        payload = {
            'rating': int(rating),
            'comment': str(comment),
            'name': name,
            'email': email,
            'createdAt': datetime.datetime.now().isoformat()
        }
        
        if db:
            try:
                db.collection('feedbacks').add(payload)
                print("Feedback captured successfully in Firestore feedbacks catalog.")
            except Exception as fs_err:
                print("Failed storing feedback in Firestore feedbacks catalog, fallback to console log:", fs_err)
                
        print(f"[LOCAL STORE LOG] New feedback captured: {payload}")
        return jsonify({'success': True, 'message': 'Thank you for your valuable response!'})
    except Exception as e:
        print("Feedback routing error:", e)
        return jsonify({'error': str(e)}), 500


@api_bp.route('/generate-report', methods=['POST'])
def generate_report():
    try:
        body = request.get_json() or {}
        assessment = body.get('assessment')
        user_name = body.get('username') or body.get('fullName') or 'Patient'
        
        if not assessment:
            return jsonify({'error': 'Assessment data is required'}), 400
            
        # Compile PDF report using correct helper
        pdf_buffer = generate_pdf_report(assessment, user_name=user_name)
        pdf_bytes = pdf_buffer.getvalue()
        
        # Always return base64 inside JSON along with correct proposed filename
        # This makes it robust to handle in frame contexts or standard downloads!
        import base64
        pdf_b64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        import datetime
        created_at_str = assessment.get('createdAt')
        try:
            if created_at_str:
                dt = datetime.datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                date_str = dt.strftime('%Y-%m-%d')
            else:
                date_str = datetime.datetime.now().strftime('%Y-%m-%d')
        except Exception:
            date_str = datetime.datetime.now().strftime('%Y-%m-%d')
            
        filename = f"DiaCare_Report_{user_name.replace(' ', '_')}_{date_str}.pdf"
        
        return jsonify({
            'success': True,
            'pdfBase64': pdf_b64,
            'filename': filename
        })
    except Exception as e:
        print("PDF report generation failed:", e)
        return jsonify({'error': str(e)}), 500


@api_bp.route('/send-report-email', methods=['POST'])
def send_report_email():
    print("--- INCOMING API REQUEST: POST /api/send-report-email ---")
    try:
        body = request.get_json() or {}
        print(f"[API AUDIT CODE] Request headers: {dict(request.headers)}")
        print(f"[API AUDIT CODE] Request body keys: {list(body.keys())}")
        
        email = body.get('email')
        user_name = body.get('name') or body.get('username') or body.get('fullName') or 'Patient'
        assessment = body.get('reportData') or body.get('assessment')
        
        print(f"[API AUDIT CODE] Target email: {email}")
        print(f"[API AUDIT CODE] Extracted username: {user_name}")
        print(f"[API AUDIT CODE] Contains assessment payload: {assessment is not None}")
        
        if not email or "@" not in email or "." not in email:
            print("[API DIAGNOSTIC ERROR] Emptied or invalid email parameter received.")
            return jsonify({'error': 'A valid recipient email address is strictly required.'}), 400
            
        if not assessment:
            print("[API DIAGNOSTIC ERROR] No assessment / reportData block found in request body.")
            return jsonify({'error': 'Clinical assessment report data (reportData) is required.'}), 400
            
        print("[API AUDIT CODE] Executing generate_pdf_report compiler...")
        pdf_buffer = generate_pdf_report(assessment, user_name=user_name)
        print("[API AUDIT CODE] PDF binary buffer compiled successfully.")
        
        print(f"[API AUDIT CODE] Relaying PDF attachment to send_assessment_email dispatcher...")
        status, courier_resp = send_assessment_email(email, assessment, pdf_buffer, user_name=user_name)
        
        if status:
            print("[API AUDIT CODE] Assessment report card email cycle finished successfully!")
            return jsonify({
                'success': True,
                'message': f"Report successfully dispatched to {email}!",
                'preview': courier_resp
            })
        else:
            print(f"[API AUDIT CODE ERROR] Mail dispatcher reported failure: {courier_resp}")
            return jsonify({
                'success': False,
                'error': courier_resp
            })
            
    except Exception as e:
        print("Mail proxy engine crashed catastrophically:", e)
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f"Catastrophic dispatch engine failure: {str(e)}"
        })
