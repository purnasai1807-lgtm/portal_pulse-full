import json
import os
import re
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from functools import wraps

import requests
import stripe
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from sqlalchemy import func
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash

from ai_engine import analyze_portal
from chatbot import generate_response
from models import AppSetting, Portal, PortalAlert, PortalCheck, User, db
from stripe_payment import create_checkout_session, get_subscription_status, cancel_subscription, get_portal_limit, handle_webhook, PLANS

APP_NAME = "PortalPulse Pro"

def normalize_database_url(value):
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql://", 1)
    return value

def normalize_text(text):
    return re.sub(r"\s+", " ", text).strip().lower()

def get_nested_value(data, path):
    current = data
    for part in path.split("."):
        if isinstance(current, list):
            current = current[int(part)]
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current

def find_first_match(text, words):
    lowered = text.lower()
    for word in words:
        if word.lower() in lowered:
            return word
    return ""

def evaluate_html(text, trigger_words, block_words):
    cleaned = normalize_text(text)
    blocked = find_first_match(cleaned, block_words)
    if blocked:
        return False, "Blocked or unavailable state detected", blocked
    matched = find_first_match(cleaned, trigger_words)
    if matched:
        return True, "Possible availability detected", matched
    return False, "No clear status found", ""

def evaluate_json(data, json_rules, block_words):
    serialized = normalize_text(json.dumps(data, ensure_ascii=False))
    blocked = find_first_match(serialized, block_words)
    if blocked:
        return False, "Blocked or unavailable state detected", blocked
    for rule in json_rules:
        path = rule.get("path", "")
        mode = rule.get("mode", "equals")
        value = rule.get("value")
        actual = get_nested_value(data, path) if path else None
        if mode == "exists" and actual is not None:
            return True, f"JSON path exists at {path}", str(actual)[:120]
        if mode == "equals" and actual == value:
            return True, f"JSON value matched at {path}", str(actual)[:120]
        if mode == "contains" and isinstance(actual, str) and isinstance(value, str) and value.lower() in actual.lower():
            return True, f"JSON text matched at {path}", actual[:120]
    return False, "No clear JSON status found", ""

def parse_json_text(value, fallback):
    try:
        return json.loads(value) if value else fallback
    except Exception:
        return fallback

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

def validate_portal_payload(payload):
    name = (payload.get("name") or "").strip()
    url = (payload.get("url") or "").strip()
    mode = (payload.get("mode") or "html").strip()
    headers_json = payload.get("headers_json") or "{}"
    trigger_words_json = payload.get("trigger_words_json") or "[]"
    block_words_json = payload.get("block_words_json") or "[]"
    json_rules_json = payload.get("json_rules_json") or "[]"

    if not name or not url:
        return None, "Name and URL are required"

    try:
        headers = json.loads(headers_json)
        trigger_words = json.loads(trigger_words_json)
        block_words = json.loads(block_words_json)
        json_rules = json.loads(json_rules_json)
    except Exception:
        return None, "One or more JSON fields are invalid"

    if not isinstance(headers, dict):
        return None, "Headers JSON must be an object"
    if not isinstance(trigger_words, list):
        return None, "Trigger words JSON must be a list"
    if not isinstance(block_words, list):
        return None, "Block words JSON must be a list"
    if not isinstance(json_rules, list):
        return None, "JSON rules JSON must be a list"
    if mode not in ["html", "json"]:
        return None, "Mode must be html or json"

    priority_level = (payload.get("priority_level") or "medium").strip().lower()
    if priority_level not in ["low", "medium", "high"]:
        return None, "Priority must be low, medium, or high"

    return {
        "name": name,
        "url": url,
        "mode": mode,
        "headers_json": headers_json,
        "trigger_words_json": trigger_words_json,
        "block_words_json": block_words_json,
        "json_rules_json": json_rules_json,
        "is_active": bool(payload.get("is_active", True)),
        "fast_mode": bool(payload.get("fast_mode", False)),
        "priority_level": priority_level
    }, None

def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-me")
    database_url = normalize_database_url(os.environ.get("DATABASE_URL", "sqlite:///portalpulse.db"))
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    frontend_origins = [
        origin.strip()
        for origin in os.environ.get("FRONTEND_URL", "http://localhost:5173").split(",")
        if origin.strip()
    ]
    use_secure_cookies = not any(origin.startswith("http://localhost") for origin in frontend_origins)

    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SECURE"] = use_secure_cookies
    app.config["SESSION_COOKIE_SAMESITE"] = "None" if use_secure_cookies else "Lax"

    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
    CORS(app, supports_credentials=True, origins=frontend_origins)

    db.init_app(app)
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

    with app.app_context():
        db.create_all()
        if not AppSetting.query.get(1):
            db.session.add(AppSetting(id=1))
            db.session.commit()

    def current_user():
        uid = session.get("user_id")
        if not uid:
            return None
        return User.query.get(uid)

    def login_required(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not current_user():
                return jsonify({"error": "Unauthorized"}), 401
            return fn(*args, **kwargs)
        return wrapper

    def admin_required(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "Unauthorized"}), 401
            if not user.is_admin:
                return jsonify({"error": "Admin access required"}), 403
            return fn(*args, **kwargs)
        return wrapper

    def paid_required(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "Unauthorized"}), 401
            if user.subscription_status not in ["active", "trialing"]:
                return jsonify({"error": "Active subscription required"}), 403
            return fn(*args, **kwargs)
        return wrapper

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "app": APP_NAME})

    @app.get("/")
    def index():
        return jsonify({"status": "ok", "app": APP_NAME, "health": "/api/health"})

    @app.post("/api/auth/register")
    def register():
        data = request.get_json(force=True)
        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "").strip()

        if not name or not email or not password:
            return jsonify({"error": "All fields are required"}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already exists"}), 400

        is_first_user = User.query.count() == 0
        admin_email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
        user = User(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            is_admin=(email == admin_email) if admin_email else is_first_user,
            plan="free",
            subscription_status="active"
        )
        db.session.add(user)
        db.session.commit()
        return jsonify({"message": "Account created successfully"})

    @app.post("/api/auth/login")
    def login():
        data = request.get_json(force=True)
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "").strip()

        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid credentials"}), 400

        if user.plan == "free" and not user.stripe_subscription_id and user.subscription_status != "active":
            user.subscription_status = "active"
            db.session.commit()

        session["user_id"] = user.id
        return jsonify({
            "message": "Login successful",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "is_admin": user.is_admin,
                "subscription_status": user.subscription_status,
                "plan": user.plan
            }
        })

    @app.post("/api/auth/logout")
    def logout():
        session.clear()
        return jsonify({"message": "Logged out"})

    @app.get("/api/auth/me")
    def me():
        user = current_user()
        if not user:
            return jsonify({"user": None})
        return jsonify({
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "is_admin": user.is_admin,
                "subscription_status": user.subscription_status,
                "plan": user.plan,
                "stripe_customer_id": user.stripe_customer_id
            }
        })

    # === BILLING ENDPOINTS ===
    
    @app.get("/api/billing/plans")
    def get_plans():
        """Get available subscription plans"""
        return jsonify({
            "plans": [
                {"id": k, "name": v["name"], "price": v["price"], "portals": v["portals"]}
                for k, v in PLANS.items()
            ]
        })

    @app.get("/api/billing/status")
    @login_required
    def billing_status():
        """Get current subscription status"""
        user = current_user()
        status = get_subscription_status(user)
        portal_limit = get_portal_limit(user)
        portal_count = Portal.query.filter_by(user_id=user.id).count()
        
        return jsonify({
            "subscription": status,
            "portal_limit": portal_limit,
            "portal_count": portal_count,
            "portals_remaining": max(0, portal_limit - portal_count)
        })

    @app.post("/api/billing/create-checkout-session")
    @login_required
    def checkout():
        user = current_user()
        data = request.get_json(force=True) or {}
        plan_type = (data.get("plan") or "pro").strip().lower()

        if plan_type not in PLANS:
            return jsonify({"error": "Invalid plan"}), 400

        checkout_session = create_checkout_session(user, plan_type)
        if not checkout_session:
            return jsonify({"error": "Stripe is not configured for this plan"}), 400

        return jsonify({"url": checkout_session.url})

    @app.post("/api/billing/portal")
    @login_required
    def billing_portal():
        user = current_user()
        app_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

        if not stripe.api_key or not user.stripe_customer_id:
            return jsonify({"error": "Billing portal is not available"}), 400

        portal_session = stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=f"{app_url}/dashboard"
        )
        return jsonify({"url": portal_session.url})

    @app.post("/api/billing/cancel-subscription")
    @login_required
    def billing_cancel_subscription():
        """Cancel user's subscription"""
        user = current_user()
        if cancel_subscription(user):
            return jsonify({"message": "Subscription canceled"})
        return jsonify({"error": "Failed to cancel subscription"}), 400

    @app.post("/api/webhook/stripe")
    def stripe_webhook():
        """Handle Stripe webhook events"""
        payload = request.get_data(as_text=True)
        sig_header = request.headers.get("stripe-signature")
        webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        except ValueError:
            return jsonify({"error": "Invalid payload"}), 400
        except stripe.error.SignatureVerificationError:
            return jsonify({"error": "Invalid signature"}), 400

        handle_webhook(event)
        return jsonify({"received": True})

    @app.post("/api/billing/stripe/webhook")
    def stripe_webhook_legacy():
        """Legacy webhook endpoint for backward compatibility"""
        return stripe_webhook()

    @app.get("/api/dashboard")
    @login_required
    def dashboard():
        user = current_user()
        portals = Portal.query.filter_by(user_id=user.id).order_by(Portal.id.desc()).all()
        portal_cards = []
        total_checks = 0
        total_alerts = 0

        for portal in portals:
            latest_check = PortalCheck.query.filter_by(portal_id=portal.id).order_by(PortalCheck.id.desc()).first()
            checks_count = PortalCheck.query.filter_by(portal_id=portal.id).count()
            alerts_count = PortalAlert.query.filter_by(portal_id=portal.id).count()
            checks = PortalCheck.query.filter_by(portal_id=portal.id).all()
            ai = analyze_portal(checks)

            total_checks += checks_count
            total_alerts += alerts_count
            portal_cards.append({
                "portal": {
                    "id": portal.id,
                    "name": portal.name,
                    "url": portal.url,
                    "mode": portal.mode,
                    "is_active": portal.is_active,
                    "fast_mode": portal.fast_mode,
                    "priority_level": portal.priority_level
                },
                "latest_check": {
                    "status_text": latest_check.status_text if latest_check else None,
                    "match_text": latest_check.match_text if latest_check else None,
                    "checked_at": latest_check.checked_at.isoformat() if latest_check else None
                },
                "checks_count": checks_count,
                "alerts_count": alerts_count,
                "ai": ai
            })

        return jsonify({
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "is_admin": user.is_admin,
                "subscription_status": user.subscription_status,
                "stripe_customer_id": user.stripe_customer_id
            },
            "totals": {
                "portals": len(portals),
                "checks": total_checks,
                "alerts": total_alerts
            },
            "portals": portal_cards
        })

    @app.post("/api/chatbot")
    @login_required
    def chatbot():
        user = current_user()
        portals = Portal.query.filter_by(user_id=user.id).all()
        if not portals:
            return jsonify({"response": "No portal data available."})
        first_portal = portals[0]
        checks = PortalCheck.query.filter_by(portal_id=first_portal.id).all()
        ai = analyze_portal(checks)
        query = (request.get_json(force=True) or {}).get("query", "")
        return jsonify({"response": generate_response(query, ai)})

    @app.get("/api/portals")
    @login_required
    def list_portals():
        user = current_user()
        portals = Portal.query.filter_by(user_id=user.id).order_by(Portal.id.desc()).all()
        return jsonify({
            "portals": [
                {
                    "id": p.id,
                    "name": p.name,
                    "url": p.url,
                    "mode": p.mode,
                    "headers_json": p.headers_json,
                    "trigger_words_json": p.trigger_words_json,
                    "block_words_json": p.block_words_json,
                    "json_rules_json": p.json_rules_json,
                    "is_active": p.is_active,
                    "fast_mode": p.fast_mode,
                    "priority_level": p.priority_level
                }
                for p in portals
            ]
        })

    @app.post("/api/portals")
    @login_required
    def create_portal():
        user = current_user()
        payload, error = validate_portal_payload(request.get_json(force=True))
        if error:
            return jsonify({"error": error}), 400

        # Check portal limit
        portal_limit = get_portal_limit(user)
        portal_count = Portal.query.filter_by(user_id=user.id).count()
        if portal_count >= portal_limit:
            return jsonify({
                "error": f"Portal limit reached ({portal_limit}). Upgrade your plan to create more portals."
            }), 403

        portal = Portal(
            user_id=user.id,
            name=payload["name"],
            url=payload["url"],
            mode=payload["mode"],
            headers_json=payload["headers_json"],
            trigger_words_json=payload["trigger_words_json"],
            block_words_json=payload["block_words_json"],
            json_rules_json=payload["json_rules_json"],
            is_active=payload["is_active"],
            fast_mode=payload["fast_mode"],
            priority_level=payload["priority_level"],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.session.add(portal)
        db.session.commit()
        return jsonify({"message": "Portal created", "id": portal.id})

    @app.put("/api/portals/<int:portal_id>")
    @login_required
    def update_portal(portal_id):
        user = current_user()
        portal = Portal.query.filter_by(id=portal_id, user_id=user.id).first()
        if not portal:
            return jsonify({"error": "Not found"}), 404

        payload, error = validate_portal_payload(request.get_json(force=True))
        if error:
            return jsonify({"error": error}), 400

        portal.name = payload["name"]
        portal.url = payload["url"]
        portal.mode = payload["mode"]
        portal.headers_json = payload["headers_json"]
        portal.trigger_words_json = payload["trigger_words_json"]
        portal.block_words_json = payload["block_words_json"]
        portal.json_rules_json = payload["json_rules_json"]
        portal.is_active = payload["is_active"]
        portal.fast_mode = payload["fast_mode"]
        portal.priority_level = payload["priority_level"]
        portal.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"message": "Portal updated"})

    @app.delete("/api/portals/<int:portal_id>")
    @login_required
    def delete_portal(portal_id):
        user = current_user()
        portal = Portal.query.filter_by(id=portal_id, user_id=user.id).first()
        if not portal:
            return jsonify({"error": "Not found"}), 404

        PortalCheck.query.filter_by(portal_id=portal.id).delete()
        PortalAlert.query.filter_by(portal_id=portal.id).delete()
        db.session.delete(portal)
        db.session.commit()
        return jsonify({"message": "Portal deleted"})

    @app.post("/api/portals/<int:portal_id>/test")
    @login_required
    def test_portal(portal_id):
        user = current_user()
        portal = Portal.query.filter_by(id=portal_id, user_id=user.id).first()
        if not portal:
            return jsonify({"error": "Not found"}), 404

        try:
            headers = parse_json_text(portal.headers_json, {})
            trigger_words = parse_json_text(portal.trigger_words_json, [])
            block_words = parse_json_text(portal.block_words_json, [])
            json_rules = parse_json_text(portal.json_rules_json, [])

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
            return jsonify({"message": "Test complete", "status_text": status_text})
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @app.get("/api/portals/<int:portal_id>/history")
    @login_required
    def portal_history(portal_id):
        user = current_user()
        portal = Portal.query.filter_by(id=portal_id, user_id=user.id).first()
        if not portal:
            return jsonify({"error": "Not found"}), 404

        history = PortalCheck.query.filter_by(portal_id=portal.id).order_by(PortalCheck.id.desc()).limit(100).all()
        alerts = PortalAlert.query.filter_by(portal_id=portal.id).order_by(PortalAlert.id.desc()).limit(50).all()

        return jsonify({
            "portal": {
                "id": portal.id,
                "name": portal.name,
                "url": portal.url
            },
            "history": [
                {
                    "id": h.id,
                    "checked_at": h.checked_at.isoformat(),
                    "status_text": h.status_text,
                    "is_triggered": h.is_triggered,
                    "match_text": h.match_text
                } for h in history
            ],
            "alerts": [
                {
                    "id": a.id,
                    "alerted_at": a.alerted_at.isoformat(),
                    "message": a.message
                } for a in alerts
            ]
        })

    @app.get("/api/settings")
    @admin_required
    def get_settings():
        settings_row = AppSetting.query.get(1)
        return jsonify({
            "telegram_bot_token": settings_row.telegram_bot_token,
            "telegram_chat_id": settings_row.telegram_chat_id,
            "whatsapp_graph_api_version": settings_row.whatsapp_graph_api_version,
            "whatsapp_phone_number_id": settings_row.whatsapp_phone_number_id,
            "whatsapp_access_token": settings_row.whatsapp_access_token,
            "whatsapp_recipient_phone_number": settings_row.whatsapp_recipient_phone_number
        })

    @app.put("/api/settings")
    @admin_required
    def update_settings():
        settings_row = AppSetting.query.get(1)
        data = request.get_json(force=True)
        settings_row.telegram_bot_token = (data.get("telegram_bot_token") or "").strip()
        settings_row.telegram_chat_id = (data.get("telegram_chat_id") or "").strip()
        settings_row.whatsapp_graph_api_version = (data.get("whatsapp_graph_api_version") or "v23.0").strip()
        settings_row.whatsapp_phone_number_id = (data.get("whatsapp_phone_number_id") or "").strip()
        settings_row.whatsapp_access_token = (data.get("whatsapp_access_token") or "").strip()
        settings_row.whatsapp_recipient_phone_number = (data.get("whatsapp_recipient_phone_number") or "").strip()
        db.session.commit()
        return jsonify({"message": "Settings saved"})

    @app.post("/api/settings/test-email")
    @admin_required
    def test_email():
        user = current_user()
        ok = send_email("PortalPulse Test Email", "Your email alerts are working.", user.email)
        if ok:
            return jsonify({"message": "Test email sent"})
        return jsonify({"error": "Email config is missing or invalid"}), 400

    @app.get("/api/admin")
    @admin_required
    def admin_dashboard():
        users_count = User.query.count()
        portals_count = Portal.query.count()
        checks_count = PortalCheck.query.count()
        alerts_count = PortalAlert.query.count()

        recent_users = User.query.order_by(User.id.desc()).limit(10).all()
        recent_alerts = PortalAlert.query.order_by(PortalAlert.id.desc()).limit(10).all()

        today = datetime.utcnow().date()
        days = []
        checks_series = []
        alerts_series = []

        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            next_day = day + timedelta(days=1)

            checks_day = PortalCheck.query.filter(
                PortalCheck.checked_at >= datetime.combine(day, datetime.min.time()),
                PortalCheck.checked_at < datetime.combine(next_day, datetime.min.time())
            ).count()

            alerts_day = PortalAlert.query.filter(
                PortalAlert.alerted_at >= datetime.combine(day, datetime.min.time()),
                PortalAlert.alerted_at < datetime.combine(next_day, datetime.min.time())
            ).count()

            days.append(day.strftime("%d %b"))
            checks_series.append(checks_day)
            alerts_series.append(alerts_day)

        top_portals_raw = db.session.query(
            Portal.name,
            func.count(PortalCheck.id)
        ).join(PortalCheck, Portal.id == PortalCheck.portal_id).group_by(Portal.name).order_by(func.count(PortalCheck.id).desc()).limit(5).all()

        return jsonify({
            "totals": {
                "users": users_count,
                "portals": portals_count,
                "checks": checks_count,
                "alerts": alerts_count
            },
            "recent_users": [
                {"id": u.id, "name": u.name, "email": u.email, "created_at": u.created_at.isoformat()}
                for u in recent_users
            ],
            "recent_alerts": [
                {"id": a.id, "alerted_at": a.alerted_at.isoformat(), "message": a.message}
                for a in recent_alerts
            ],
            "days": days,
            "checks_series": checks_series,
            "alerts_series": alerts_series,
            "top_portal_labels": [r[0] for r in top_portals_raw],
            "top_portal_values": [r[1] for r in top_portals_raw]
        })

    return app

app = create_app()
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

