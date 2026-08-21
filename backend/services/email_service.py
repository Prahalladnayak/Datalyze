import os
import smtplib
import asyncio
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

async def send_email_resend_http(to_email: str, subject: str, html_content: str, text_content: str = ""):
    """
    Sends email via Resend HTTP REST API on HTTPS Port 443.
    100% immune to cloud container firewall blocks (Render/AWS/GCP).
    """
    resend_api_key = (os.getenv("RESEND_API_KEY", "")).strip().strip("'\"")
    if not resend_api_key:
        return False

    sender_email = (os.getenv("EMAIL_FROM", "") or "Datalyze <onboarding@resend.dev>").strip().strip("'\"")
    if not sender_email or "@" not in sender_email:
        sender_email = "Datalyze <onboarding@resend.dev>"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            payload = {
                "from": sender_email,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            }
            if text_content:
                payload["text"] = text_content

            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json"
                },
                json=payload
            )

            if resp.status_code in [200, 201]:
                print(f"[RESEND HTTP SUCCESS] Sent email to {to_email} with subject '{subject}'")
                return True
            else:
                print(f"[RESEND HTTP ERROR] Status {resp.status_code}: {resp.text}")
                return False
    except Exception as e:
        print(f"[RESEND HTTP EXCEPTION] {e}")
        return False

def send_email_sync(to_email: str, subject: str, html_content: str, text_content: str = ""):
    """
    Synchronous SMTP email sender with cloud optimization.
    Attempts Port 465 (SSL) and Port 587 (TLS).
    """
    smtp_host = (os.getenv("SMTP_HOST", "") or os.getenv("EMAIL_HOST", "")).strip().strip("'\"")
    smtp_port_str = (os.getenv("SMTP_PORT", "") or os.getenv("EMAIL_PORT", "")).strip().strip("'\"")
    smtp_username = (os.getenv("SMTP_USERNAME", "") or os.getenv("EMAIL_USERNAME", "")).strip().strip("'\"")
    smtp_password = (os.getenv("SMTP_PASSWORD", "") or os.getenv("EMAIL_PASSWORD", "")).strip().strip("'\"")
    smtp_sender = (os.getenv("SMTP_SENDER", "") or os.getenv("EMAIL_FROM", "") or smtp_username).strip().strip("'\"") or "noreply@datalyze.com"

    if not smtp_host or not smtp_username or not smtp_password:
        raise ValueError(
            "SMTP is not configured. Missing required email environment variables (EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD)."
        )

    clean_password = smtp_password.replace(" ", "") if (len(smtp_password) == 19 and smtp_password.count(" ") == 3) else smtp_password

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_sender
    msg["To"] = to_email

    if text_content:
        msg.attach(MIMEText(text_content, "plain", "utf-8"))
    if html_content:
        msg.attach(MIMEText(html_content, "html", "utf-8"))

    configured_port = int(smtp_port_str) if smtp_port_str else 465
    ports_to_try = [465, 587] if configured_port in [465, 587] else [configured_port, 465, 587]

    last_error = None
    for port in ports_to_try:
        try:
            if port == 465:
                with smtplib.SMTP_SSL(smtp_host, port, timeout=5) as server:
                    server.login(smtp_username, clean_password)
                    server.sendmail(smtp_sender, to_email, msg.as_string())
            else:
                with smtplib.SMTP(smtp_host, port, timeout=5) as server:
                    server.starttls()
                    server.login(smtp_username, clean_password)
                    server.sendmail(smtp_sender, to_email, msg.as_string())
            print(f"[EMAIL SUCCESS] Sent email to {to_email} via {smtp_host}:{port} with subject '{subject}'")
            return
        except Exception as e:
            print(f"[EMAIL ATTEMPT FAILED] Port {port} failed: {e}")
            last_error = e

    raise last_error

async def send_email(to_email: str, subject: str, html_content: str, text_content: str = ""):
    """
    Asynchronous email dispatcher.
    1. Tries Resend HTTPS API (Port 443) if RESEND_API_KEY is configured.
    2. Otherwise falls back to SMTP (Ports 465 / 587).
    """
    # 1. Try Resend HTTP API if configured
    if os.getenv("RESEND_API_KEY"):
        success = await send_email_resend_http(to_email, subject, html_content, text_content)
        if success:
            return

    # 2. Try SMTP
    await asyncio.to_thread(send_email_sync, to_email, subject, html_content, text_content)
