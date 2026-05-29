import os
import smtplib
import socket
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from dotenv import load_dotenv

# Ensure credentials from .env are fully loaded
load_dotenv()

def verify_smtp_login():
    """
    Verbously tests connection and authenticates against the specified Gmail SMTP server.
    Provides detailed diagnosing for:
    - Missing environment variables
    - Connection timeouts (e.g. preview environment port blocking)
    - SMTP authentication failures
    """
    smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
    smtp_port = os.environ.get('SMTP_PORT', '587')
    smtp_user = os.environ.get('EMAIL_USER') or os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('EMAIL_PASSWORD') or os.environ.get('SMTP_PASSWORD')

    # Status 1: Inspect environment variable matching
    if not smtp_user:
        err_msg = "ENVIRONMENT ERROR: Missing optional 'EMAIL_USER' environment variable in .env. Falling back to Simulated Dispatch."
        print(f"[SMTP VERIFICATION FAILURE] {err_msg}")
        return False, err_msg

    if not smtp_password:
        err_msg = "ENVIRONMENT ERROR: Missing optional 'EMAIL_PASSWORD' environment variable in .env. Falling back to Simulated Dispatch."
        print(f"[SMTP VERIFICATION FAILURE] {err_msg}")
        return False, err_msg

    print(f"[SMTP DIAGNOSTIC] EMAIL_USER environment variable successfully loaded: '{smtp_user}'")
    raw_password_len = len(smtp_password)
    has_spaces = " " in smtp_password
    print(f"[SMTP DIAGNOSTIC] EMAIL_PASSWORD environment variable successfully loaded (Raw Length: {raw_password_len}, contains spaces: {has_spaces})")

    # Sanitize password as required (strip spaces for app password compatibility)
    smtp_password = smtp_password.replace(" ", "")
    print(f"[SMTP DIAGNOSTIC] EMAIL_PASSWORD prepared (Length after spacing cleanup: {len(smtp_password)})")

    print(f"--- SMTP PRE-FLIGHT VERIFICATION: TESTING CONNECTIVITY TO {smtp_host}:{smtp_port} ---")
    server = None
    try:
        port = int(smtp_port)
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=5)
            print("[SMTP VERIFICATION] Established direct SSL connection.")
        else:
            print(f"[SMTP VERIFICATION] Connecting to {smtp_host}:{port} with 5s timeout...")
            server = smtplib.SMTP(smtp_host, port, timeout=5)
            server.ehlo()
            print("[SMTP VERIFICATION] Server connected. Upgrading connection to STARTTLS...")
            server.starttls()
            server.ehlo()
            
        print(f"[SMTP VERIFICATION] Attempting login authentication for credentials: {smtp_user}")
        login_res = server.login(smtp_user, smtp_password)
        login_code, login_resp = login_res
        login_resp_str = login_resp.decode('utf-8', errors='ignore') if isinstance(login_resp, bytes) else str(login_resp)
        print(f"[SMTP VERIFICATION] Authentication success! Credentials verified. Response: {login_code} {login_resp_str}")
        server.quit()
        return True, f"Login verified successfully. Response: {login_code} {login_resp_str}"
    except smtplib.SMTPAuthenticationError as auth_err:
        err_msg = f"AUTHENTICATION ERROR: Gmail SMTP Authentication Refused. Ensure EMAIL_USER matches your Gmail, and EMAIL_PASSWORD is a valid 16-character Gmail App Password (not your primary Google Account password). Details: {str(auth_err)}"
        print(f"[SMTP VERIFICATION FAILURE] {err_msg}")
        return False, err_msg
    except socket.timeout:
        err_msg = f"PORT BLOCK ERROR: SMTP Connection Timed Out. Outbound connection on port {smtp_port} is BLOCKED by the Google AI Studio preview sandbox firewall to prevent utility mail spam. Direct Gmail SMTP dispatch is unavailable in this environment."
        print(f"[SMTP VERIFICATION FAILURE] {err_msg}")
        return False, err_msg
    except OSError as os_err:
        err_msg = f"PORT BLOCK ERROR: SMTP Network Connection Failed. Outbound connection on port {smtp_port} (STARTTLS) on {smtp_host} is blocked/restricted by the preview sandbox container environment. Direct SMTP dispatch is unavailable. Details: {str(os_err)}"
        print(f"[SMTP VERIFICATION FAILURE] {err_msg}")
        return False, err_msg
    except Exception as e:
        err_msg = f"SMTP SYSTEM ERROR: Connection/Authentication with Gmail SMTP server failed. Details: {str(e)}"
        print(f"[SMTP VERIFICATION FAILURE] {err_msg}")
        return False, err_msg
    finally:
        try:
            if server:
                server.close()
        except Exception:
            pass


def send_assessment_email(to_email, assessment, pdf_buffer, user_name="Patient"):
    """
    Sends an email to the patient with the attached PDF report.
    Supports secure SSL/TLS dispatch if SMTP credentials are provided,
    otherwise falls back to an elegant simulated log with HTML schema preview.
    """
    smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
    smtp_port = os.environ.get('SMTP_PORT', '587')
    smtp_user = os.environ.get('EMAIL_USER') or os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('EMAIL_PASSWORD') or os.environ.get('SMTP_PASSWORD')
    
    if smtp_password:
        # Strip spaces from App Password
        smtp_password = smtp_password.replace(" ", "")
    
    import datetime
    
    # Simple email integrity check
    if not to_email or "@" not in to_email or "." not in to_email:
        print(f"[MAIL INTEGRITY ERROR] Attempted send to invalid email schema: '{to_email}'")
        return False, "DELIVERY ERROR: Invalid recipient email address format."

    # Validate PDF generation output before email sending logic is processed
    if not pdf_buffer:
        print("[PDF DIAGNOSTIC ERROR] No PDF binary data stream available.")
        return False, "PDF COMPILATION ERROR: PDF generation failed. No buffer stream is available for attachment."

    print("[PDF DIAGNOSTIC] Verifying pdf_buffer length...")
    pdf_buffer.seek(0)
    pdf_data = pdf_buffer.read()
    pdf_size = len(pdf_data)
    print(f"[PDF DIAGNOSTIC] PDF compilation verified successfully. File size: {pdf_size} bytes.")
    if pdf_size == 0:
        return False, "PDF COMPILATION ERROR: Compiled PDF contains 0 bytes."

    # Perform pre-flight SMTP login verification if optional credentials are configured
    if smtp_user and smtp_password:
        print("[SMTP VERIFICATION] Pre-flight verification requested for active SMTP configurations...")
        ver_status, ver_msg = verify_smtp_login()
        if not ver_status:
            return False, f"Pre-flight SMTP verification failed: {ver_msg}"
    else:
        print("[SMTP WARNING] Optional EMAIL_USER/EMAIL_PASSWORD credentials are not configured in local environment variables. Falling back to the simulated outbox courier preview.")

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
    subject = "Your DiaCare AI Health Assessment Report"
    
    body_text = f"""Hello {user_name},

Thank you for choosing DiaCare AI.

Your digital diabetes screening assessment and medical report has been compiled and is attached below as a high-fidelity PDF.

KEY HIGHLIGHTS:
- Assessed Risk Level: {str(assessment.get('riskLevel', 'N/A')).upper()}
- Calibration Status: {"Clinically Calibrated" if assessment.get('clinicallyPredicted') else "Standard Questionnaire Basis"}
- Timestamp: {date_str}

Please remember:
This screening tool is provided for educational and awareness purposes only. It is not a clinical diagnosis or a replacement for an in-person consulting physician.

To your health,
DiaCare AI Medical Dispatch System"""

    # If SMTP credentials are fully provided, perform genuine dispatch
    if smtp_user and smtp_password:
        print(f"--- SMTP OUTBOX DISPATCH: INITIALIZING DELIVERY TO {to_email} ---")
        print(f"[SMTP DIAGNOSTIC] Host: {smtp_host} | Port: {smtp_port} | User: {smtp_user}")
        server = None
        try:
            msg = MIMEMultipart()
            msg['From'] = smtp_user
            msg['To'] = to_email
            msg['Subject'] = subject
            
            msg.attach(MIMEText(body_text, 'plain'))
            
            attachment = MIMEApplication(pdf_data, _subtype="pdf")
            attachment.add_header('Content-Disposition', 'attachment', filename=filename)
            msg.attach(attachment)
            
            port = int(smtp_port)
            
            print(f"[SMTP DIAGNOSTIC] Dialing host {smtp_host}:{port} with 5-second timeout...")
            if port == 465:
                server = smtplib.SMTP_SSL(smtp_host, port, timeout=5)
                print("[SMTP DIAGNOSTIC] Established direct SSL connection.")
            else:
                server = smtplib.SMTP(smtp_host, port, timeout=5)
                print("[SMTP DIAGNOSTIC] Connected. Sending EHLO...")
                server.ehlo()
                
                print("[SMTP DIAGNOSTIC] Initiating STARTTLS secure tunnel...")
                server.starttls()
                
                print("[SMTP DIAGNOSTIC] Sending post-STARTTLS EHLO...")
                server.ehlo()
                
            print(f"[SMTP DIAGNOSTIC] Authenticating credentials for user {smtp_user}...")
            login_code, login_resp = server.login(smtp_user, smtp_password)
            login_resp_str = login_resp.decode('utf-8', errors='ignore') if isinstance(login_resp, bytes) else str(login_resp)
            print(f"[SMTP DIAGNOSTIC] Authentication successful. Code: {login_code}, Response: {login_resp_str}")
            
            print(f"[SMTP DIAGNOSTIC] Dispatching message payload step-by-step to {to_email}...")
            
            # Step 1: MAIL FROM
            mail_code, mail_resp = server.mail(smtp_user)
            mail_resp_str = mail_resp.decode('utf-8', errors='ignore') if isinstance(mail_resp, bytes) else str(mail_resp)
            print(f"[SMTP RESPONSE] MAIL FROM: {mail_code} {mail_resp_str}")
            if mail_code != 250:
                raise smtplib.SMTPResponseException(mail_code, mail_resp_str)
                
            # Step 2: RCPT TO
            rcpt_code, rcpt_resp = server.rcpt(to_email)
            rcpt_resp_str = rcpt_resp.decode('utf-8', errors='ignore') if isinstance(rcpt_resp, bytes) else str(rcpt_resp)
            print(f"[SMTP RESPONSE] RCPT TO: {rcpt_code} {rcpt_resp_str}")
            if rcpt_code not in (250, 251):
                raise smtplib.SMTPResponseException(rcpt_code, rcpt_resp_str)
                
            # Step 3: DATA
            raw_email_str = msg.as_string()
            data_code, data_resp = server.data(raw_email_str)
            data_resp_str = data_resp.decode('utf-8', errors='ignore') if isinstance(data_resp, bytes) else str(data_resp)
            print(f"[SMTP RESPONSE] DATA: {data_code} {data_resp_str}")
            
            # Verify email send actually succeeds: Do not show success unless Gmail confirms delivery request accepted (code 250)
            if data_code != 250:
                raise smtplib.SMTPResponseException(data_code, data_resp_str)
            
            smtp_response_combined = f"MAIL FROM: {mail_code} {mail_resp_str} | RCPT TO: {rcpt_code} {rcpt_resp_str} | DATA: {data_code} {data_resp_str}"
            
            # Log exact outputs as requested by Requirement 4 and 5
            print("--- SMTP REPORT MAIL LOG ---")
            print(f"Sender Email: {smtp_user}")
            print(f"Recipient Email: {to_email}")
            print(f"Subject: {subject}")
            print(f"Attachment Name: {filename}")
            print(f"SMTP Response: {smtp_response_combined}")
            print("----------------------------")
            
            print("[SMTP DIAGNOSTIC] Terminating SMTP session...")
            server.quit()
            print("[SMTP DIAGNOSTIC] Session closed cleanly.")
            
            return True, f"Email successfully sent directly to inbox. Smtp Response: {data_code} {data_resp_str}"
            
        except smtplib.SMTPResponseException as resp_err:
            error_message = f"SMTP ERROR (Code {resp_err.smtp_code}): {resp_err.smtp_error.decode('utf-8', errors='ignore') if isinstance(resp_err.smtp_error, bytes) else str(resp_err.smtp_error)}"
            print(f"[SMTP CRITICAL FAIL] {error_message}")
            try:
                if server:
                    server.close()
            except Exception:
                pass
            return False, error_message
        except smtplib.SMTPAuthenticationError as auth_err:
            error_message = f"AUTHENTICATION ERROR: Gmail SMTP Authentication Refused. Verify EMAIL_USER and EMAIL_PASSWORD (valid Gmail App Password). Details: {str(auth_err)}"
            print(f"[SMTP CRITICAL FAIL] {error_message}")
            try:
                if server:
                    server.close()
            except Exception:
                pass
            return False, error_message
        except smtplib.SMTPConnectError as conn_err:
            error_message = f"FAILED TO CONNECT: SMTP server connection failure. Details: {str(conn_err)}"
            print(f"[SMTP CRITICAL FAIL] {error_message}")
            try:
                if server:
                    server.close()
            except Exception:
                pass
            return False, error_message
        except socket.timeout:
            error_message = f"TIMEOUT ERROR: SMTP Connection timed out. Outbound port {smtp_port} is likely blocked by your hosting firewall network regulations."
            print(f"[SMTP CRITICAL FAIL] {error_message}")
            try:
                if server:
                    server.close()
            except Exception:
                pass
            return False, error_message
        except OSError as os_err:
            error_message = f"PORT BLOCK ERROR: SMTP Network Connection failed. Outbound port {smtp_port} is blocked."
            print(f"[SMTP CRITICAL FAIL] {error_message}")
            try:
                if server:
                    server.close()
            except Exception:
                pass
            return False, error_message
        except Exception as smtp_generic_err:
            error_message = f"SYSTEM ERROR: An unexpected error occurred during SMTP mail transit. Details: {str(smtp_generic_err)}"
            print(f"[SMTP CRITICAL FAIL] {error_message}")
            try:
                if server:
                    server.close()
            except Exception:
                pass
            return False, error_message
    else:
        # Fall back to simulation outbox
        print("--- SMTP SIMULATION LOGGER ---")
        print(f"[SMTP ACTION] Dispatching copy to: {to_email}")
        print(f"[SMTP ACTION] Attached PDF: {filename} size {len(pdf_data)} bytes")
        
        simulated_preview = f"""<h3>[DIACARE SMTP COURIER SIMULATION LOG]</h3>
<p style="margin: 4px 0;"><b>SMTP Host Status:</b> Simulating Loopback (Configure EMAIL_USER & EMAIL_PASSWORD environment variables for direct SMTP)</p>
<p style="margin: 4px 0;"><b>Recipient:</b> <span style="color: #0ea5e9; font-weight: bold;">{to_email}</span></p>
<p style="margin: 4px 0;"><b>Subject:</b> {subject}</p>
<p style="margin: 4px 0;"><b>Attached Deliverable:</b> {filename} ({len(pdf_data)} bytes)</p>
<hr style="border: none; border-top: 1px solid #334155; margin: 12px 0;"/>
<pre style="background: #020617; color: #94a3b8; padding: 15px; border-radius: 8px; font-family: monospace; white-space: pre-wrap; font-size: 11px; border: 1px solid #1e293b; line-height: 1.5; text-align: left;">
{body_text}
</pre>"""
        return True, simulated_preview
