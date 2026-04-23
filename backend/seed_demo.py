from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash

from app import create_app
from models import User, Portal, PortalCheck, PortalAlert, AppSetting, db

app = create_app()

with app.app_context():
    db.create_all()

    if not AppSetting.query.get(1):
        db.session.add(AppSetting(id=1))
        db.session.commit()

    demo_user = User.query.filter_by(email="demo@portalpulse.com").first()
    if not demo_user:
        demo_user = User(
            name="Demo User",
            email="demo@portalpulse.com",
            password_hash=generate_password_hash("demo123"),
            is_admin=True,
            subscription_status="active"
        )
        db.session.add(demo_user)
        db.session.commit()

    portal = Portal.query.filter_by(user_id=demo_user.id, name="Demo Ticket Portal").first()
    if not portal:
        portal = Portal(
            user_id=demo_user.id,
            name="Demo Ticket Portal",
            url="https://example.com/demo",
            mode="html",
            headers_json='{"User-Agent":"Mozilla/5.0"}',
            trigger_words_json='["available","book now","open"]',
            block_words_json='["sold out","unavailable","login"]',
            json_rules_json='[]',
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.session.add(portal)
        db.session.commit()

    if PortalCheck.query.filter_by(portal_id=portal.id).count() == 0:
        for i in range(20):
            check_time = datetime.utcnow() - timedelta(hours=i)
            triggered = i % 5 == 0
            db.session.add(PortalCheck(
                portal_id=portal.id,
                checked_at=check_time,
                status_text="Possible availability detected" if triggered else "No clear status found",
                is_triggered=triggered,
                match_text="available" if triggered else "",
                snapshot_text="demo snapshot"
            ))

        db.session.add(PortalAlert(
            portal_id=portal.id,
            alerted_at=datetime.utcnow() - timedelta(hours=2),
            message="Demo alert: availability detected",
            fingerprint="demo-alert-1"
        ))
        db.session.commit()

    print("Demo seeded")
    print("Email: demo@portalpulse.com")
    print("Password: demo123")
