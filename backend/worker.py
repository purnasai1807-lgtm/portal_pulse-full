import json
import os
import re
import smtplib
import time
from datetime import datetime, timedelta
from email.mime.text import MIMEText

import requests

from app import create_app, evaluate_html, evaluate_json, normalize_text
from models import AppSetting, Portal, PortalAlert, PortalCheck, User, db

app = create_app()

def send_telegram(message):
    with app.app_context():
        settings = AppSetting.query.get(1)
        if not settings or not settings.telegram_bot_token or not settings.telegram_chat_id:
            return False

        url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
        payload = {
            "chat_id": settings.telegram_chat_id,
            "text": message,
            "parse_mode": "HTML"
        }
        try:
            response = requests.post(url, json=payload, timeout=10)
            return response.status_code == 200
        except Exception:
            return False

def send_whatsapp(message):
    with app.app_context():
        settings = AppSetting.query.get(1)
        if not settings or not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id or not settings.whatsapp_recipient_phone_number:
            return False

        url = f"https://graph.facebook.com/{settings.whatsapp_graph_api_version}/{settings.whatsapp_phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {settings.whatsapp_access_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": settings.whatsapp_recipient_phone_number,
            "type": "text",
            "text": {"body": message}
        }
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            return response.status_code == 200
        except Exception:
            return False

def send_email(subject, body, to_email):
    host = os.environ.get("EMAIL_HOST", "")
    port = os.environ.get("EMAIL_PORT", "")
    user = os.environ.get("EMAIL_USER", "")
    password = os.environ.get("EMAIL_PASS", "")
    sender = os.environ.get("EMAIL_FROM", user)

    if not host or not port or not user or not password or not to_email:
        return False

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_email

    try:
        server = smtplib.SMTP(host, int(port))
        server.starttls()
        server.login(user, password)
        server.sendmail(sender, [to_email], msg.as_string())
        server.quit()
        return True
    except Exception:
        return False

def send_alerts(portal, message):
    with app.app_context():
        user = User.query.get(portal.user_id)
        if not user:
            return

        fingerprint = f"{portal.id}:{message[:200]}"
        existing = PortalAlert.query.filter_by(portal_id=portal.id, fingerprint=fingerprint).first()
        if existing:
            return

        alert = PortalAlert(
            portal_id=portal.id,
            alerted_at=datetime.utcnow(),
            message=message,
            fingerprint=fingerprint
        )
        db.session.add(alert)
        db.session.commit()

        send_telegram(f"🔔 <b>{portal.name}</b>\n{message}")
        send_whatsapp(f"🔔 {portal.name}\n{message}")
        send_email(f"PortalPulse Alert: {portal.name}", message, user.email)

def check_portal(portal):
    with app.app_context():
        try:
            headers = json.loads(portal.headers_json or "{}")
            trigger_words = json.loads(portal.trigger_words_json or "[]")
            block_words = json.loads(portal.block_words_json or "[]")
            json_rules = json.loads(portal.json_rules_json or "[]")

            response = requests.get(portal.url, headers=headers, timeout=10)
            response.raise_for_status()

            if portal.mode == "json":
                try:
                    data = response.json()
                    triggered, status_text, match_text = evaluate_json(data, json_rules, block_words)
                    snapshot = normalize_text(json.dumps(data, ensure_ascii=False))[:800]
                except Exception:
                    text = response.text
                    triggered, status_text, match_text = evaluate_html(text, trigger_words, block_words)
                    snapshot = normalize_text(text)[:800]
            else:
                text = response.text
                triggered, status_text, match_text = evaluate_html(text, trigger_words, block_words)
                snapshot = normalize_text(text)[:800]

            check = PortalCheck(
                portal_id=portal.id,
                checked_at=datetime.utcnow(),
                status_text=status_text,
                is_triggered=triggered,
                match_text=match_text,
                snapshot_text=snapshot[:1000]
            )
            db.session.add(check)
            db.session.commit()

            if triggered:
                send_alerts(portal, f"Status: {status_text}\nMatch: {match_text}\nURL: {portal.url}")

            return True
        except Exception as e:
            error_msg = f"Check failed: {str(e)}"
            check = PortalCheck(
                portal_id=portal.id,
                checked_at=datetime.utcnow(),
                status_text=error_msg,
                is_triggered=False,
                match_text="",
                snapshot_text=""
            )
            db.session.add(check)
            db.session.commit()
            return False

def get_patterns():
    with app.app_context():
        settings = AppSetting.query.get(1)
        if not settings:
            return {
                "normal_interval_seconds": 15,
                "fast_interval_seconds": 8,
                "jitter_seconds": 1,
                "cooldown_seconds": 45,
                "timeout_seconds": 10,
                "retries": 3,
                "retry_backoff_seconds": 1
            }
        return {
            "normal_interval_seconds": settings.normal_interval_seconds,
            "fast_interval_seconds": settings.fast_interval_seconds,
            "jitter_seconds": settings.jitter_seconds,
            "cooldown_seconds": settings.cooldown_seconds,
            "timeout_seconds": settings.timeout_seconds,
            "retries": settings.retries,
            "retry_backoff_seconds": settings.retry_backoff_seconds
        }

def worker_loop():
    print("PortalPulse Worker started")
    while True:
        try:
            with app.app_context():
                portals = Portal.query.filter_by(is_active=True).all()
                patterns = get_patterns()

                for portal in portals:
                    last_check = PortalCheck.query.filter_by(portal_id=portal.id).order_by(PortalCheck.id.desc()).first()
                    now = datetime.utcnow()

                    if last_check:
                        time_since_last = (now - last_check.checked_at).total_seconds()
                        if last_check.is_triggered:
                            interval = patterns["fast_interval_seconds"]
                            if time_since_last < patterns["cooldown_seconds"]:
                                continue
                        else:
                            interval = patterns["normal_interval_seconds"]
                        if time_since_last < interval:
                            continue

                    check_portal(portal)
                    time.sleep(patterns["jitter_seconds"])
        except Exception as e:
            print(f"Worker error: {e}")

        time.sleep(1)

if __name__ == "__main__":
    worker_loop()
