import os
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email_sync(to_email: str, subject: str, html_content: str, text_content: str = ""):
    """
    Synchronous SMTP email sender with production cloud fallback.
    Tries SSL (port 465) and TLS (port 587) automatically to ensure delivery on cloud platforms.
    """
    smtp_host = (os.getenv("SMTP_HOST", "") or os.getenv("EMAIL_HOST", "")).strip()
    smtp_port_str = (os.getenv("SMTP_PORT", "") or os.getenv("EMAIL_PORT", "")).strip()
    smtp_username = (os.getenv("SMTP_USERNAME", "") or os.getenv("EMAIL_USERNAME", "")).strip()
    smtp_password = (os.getenv("SMTP_PASSWORD", "") or os.getenv("EMAIL_PASSWORD", "")).strip()
    smtp_sender = (os.getenv("SMTP_SENDER", "") or os.getenv("EMAIL_FROM", "") or smtp_username).strip() or "noreply@datalyze.com"

    # Check SMTP credentials configuration
    if not smtp_host or not smtp_username or not smtp_password:
        raise ValueError(
            "SMTP is not configured. Missing required email environment variables (EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD) on the server."
        )

    # Clean password if user provided spaces in Google App Password (e.g. 'abcd efgh ijkl mnop')
    # If it's a 16-character google app password with spaces (length 19), strip spaces
    if len(smtp_password) == 19 and smtp_password.count(" ") == 3:
        clean_password = smtp_password.replace(" ", "")
    else:
        clean_password = smtp_password

    # Create message container
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_sender
    msg["To"] = to_email

    # Attach text/html parts
    if text_content:
        msg.attach(MIMEText(text_content, "plain", "utf-8"))
    if html_content:
        msg.attach(MIMEText(html_content, "html", "utf-8"))

    preferred_port = int(smtp_port_str) if smtp_port_str else 587
    # Determine ports to attempt: preferred port first, then alternative (465 or 587)
    ports_to_try = [preferred_port]
    if preferred_port == 587:
        ports_to_try.append(465)
    elif preferred_port == 465:
        ports_to_try.append(587)
    else:
        ports_to_try.extend([465, 587])

    last_error = None
    for port in ports_to_try:
        try:
            if port == 465:
                # SSL Connection
                with smtplib.SMTP_SSL(smtp_host, port, timeout=12) as server:
                    server.login(smtp_username, clean_password)
                    server.sendmail(smtp_sender, to_email, msg.as_string())
            else:
                # TLS Connection (587 or other)
                with smtplib.SMTP(smtp_host, port, timeout=12) as server:
                    server.starttls()
                    server.login(smtp_username, clean_password)
                    server.sendmail(smtp_sender, to_email, msg.as_string())
            print(f"[EMAIL SUCCESS] Sent email to {to_email} via {smtp_host}:{port} with subject '{subject}'")
            return
        except Exception as e:
            print(f"[EMAIL ATTEMPT FAILED] Port {port} failed: {e}")
            last_error = e

    print(f"[EMAIL ERROR] All SMTP attempts failed for {to_email}: {last_error}")
    raise last_error

async def send_email(to_email: str, subject: str, html_content: str, text_content: str = ""):
    """Asynchronous wrapper around send_email_sync running in a background thread."""
    await asyncio.to_thread(send_email_sync, to_email, subject, html_content, text_content)
