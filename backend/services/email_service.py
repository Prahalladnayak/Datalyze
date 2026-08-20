import os
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email_sync(to_email: str, subject: str, html_content: str, text_content: str = ""):
    """Synchronous SMTP email sender. Handled by a thread pool when called via send_email."""
    smtp_host = (os.getenv("SMTP_HOST", "") or os.getenv("EMAIL_HOST", "")).strip()
    smtp_port_str = (os.getenv("SMTP_PORT", "") or os.getenv("EMAIL_PORT", "")).strip()
    smtp_username = (os.getenv("SMTP_USERNAME", "") or os.getenv("EMAIL_USERNAME", "")).strip()
    smtp_password = (os.getenv("SMTP_PASSWORD", "") or os.getenv("EMAIL_PASSWORD", "")).strip()
    smtp_sender = (os.getenv("SMTP_SENDER", "") or os.getenv("EMAIL_FROM", "") or smtp_username).strip() or "noreply@datalyze.com"

    # Check SMTP credentials configuration
    if not smtp_host or not smtp_username or not smtp_password:
        raise ValueError("SMTP is not configured. Missing required email environment variables (EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD).")

    smtp_port = int(smtp_port_str) if smtp_port_str else 587

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

    # Select connection type based on SMTP port
    try:
        if smtp_port == 465:
            # SSL Connection
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                server.login(smtp_username, smtp_password)
                server.sendmail(smtp_sender, to_email, msg.as_string())
        else:
            # TLS Connection (port 587 or others)
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_username, smtp_password)
                server.sendmail(smtp_sender, to_email, msg.as_string())
        print(f"[EMAIL SUCCESS] Sent email to {to_email} with subject '{subject}'")
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send email to {to_email}: {e}")
        # Re-raise so backend router can report error in logs if needed, or handle gracefully
        raise e

async def send_email(to_email: str, subject: str, html_content: str, text_content: str = ""):
    """Asynchronous wrapper around send_email_sync to keep FastAPI loop non-blocking."""
    await asyncio.to_thread(send_email_sync, to_email, subject, html_content, text_content)
