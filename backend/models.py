from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    stripe_customer_id = db.Column(db.String(255), default="", nullable=False, index=True)
    stripe_subscription_id = db.Column(db.String(255), default="", nullable=False, index=True)
    subscription_status = db.Column(db.String(50), default="inactive", nullable=False, index=True)
    plan = db.Column(db.String(20), default="free", nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

class AppSetting(db.Model):
    __tablename__ = "app_settings"
    id = db.Column(db.Integer, primary_key=True, default=1)
    telegram_bot_token = db.Column(db.String(255), default="", nullable=False)
    telegram_chat_id = db.Column(db.String(255), default="", nullable=False)
    whatsapp_graph_api_version = db.Column(db.String(32), default="v23.0", nullable=False)
    whatsapp_phone_number_id = db.Column(db.String(255), default="", nullable=False)
    whatsapp_access_token = db.Column(db.Text, default="", nullable=False)
    whatsapp_recipient_phone_number = db.Column(db.String(64), default="", nullable=False)
    normal_interval_seconds = db.Column(db.Integer, default=15, nullable=False)
    fast_interval_seconds = db.Column(db.Integer, default=8, nullable=False)
    jitter_seconds = db.Column(db.Integer, default=1, nullable=False)
    cooldown_seconds = db.Column(db.Integer, default=45, nullable=False)
    timeout_seconds = db.Column(db.Integer, default=10, nullable=False)
    retries = db.Column(db.Integer, default=3, nullable=False)
    retry_backoff_seconds = db.Column(db.Integer, default=1, nullable=False)

class Portal(db.Model):
    __tablename__ = "portals"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    url = db.Column(db.Text, nullable=False)
    mode = db.Column(db.String(20), default="html", nullable=False)
    headers_json = db.Column(db.Text, default="{}", nullable=False)
    trigger_words_json = db.Column(db.Text, default="[]", nullable=False)
    block_words_json = db.Column(db.Text, default="[]", nullable=False)
    json_rules_json = db.Column(db.Text, default="[]", nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    fast_mode = db.Column(db.Boolean, default=False, nullable=False)
    priority_level = db.Column(db.String(20), default="medium", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

class PortalCheck(db.Model):
    __tablename__ = "portal_checks"
    id = db.Column(db.Integer, primary_key=True)
    portal_id = db.Column(db.Integer, db.ForeignKey("portals.id"), nullable=False, index=True)
    checked_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    status_text = db.Column(db.String(255), nullable=False)
    is_triggered = db.Column(db.Boolean, default=False, nullable=False)
    match_text = db.Column(db.String(255), default="", nullable=False)
    snapshot_text = db.Column(db.Text, default="", nullable=False)

class PortalAlert(db.Model):
    __tablename__ = "portal_alerts"
    id = db.Column(db.Integer, primary_key=True)
    portal_id = db.Column(db.Integer, db.ForeignKey("portals.id"), nullable=False, index=True)
    alerted_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    message = db.Column(db.Text, nullable=False)
    fingerprint = db.Column(db.String(500), nullable=False)
