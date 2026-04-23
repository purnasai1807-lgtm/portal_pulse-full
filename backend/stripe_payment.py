import os
import stripe
from models import db, User
from datetime import datetime

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

# Subscription Plans
PLANS = {
    "free": {"price_id": None, "name": "Free", "portals": 2, "price": 0},
    "pro": {"price_id": os.environ.get("STRIPE_PRICE_PRO", ""), "name": "Pro", "portals": 50, "price": 29},
    "enterprise": {"price_id": os.environ.get("STRIPE_PRICE_ENTERPRISE", ""), "name": "Enterprise", "portals": 500, "price": 99}
}

def create_stripe_customer(user):
    """Create a Stripe customer for a user"""
    try:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.name,
            metadata={"user_id": user.id}
        )
        user.stripe_customer_id = customer.id
        db.session.commit()
        return customer
    except stripe.error.StripeError as e:
        return None

def create_checkout_session(user, plan_type):
    """Create a Stripe checkout session"""
    try:
        if not PLANS[plan_type]["price_id"]:
            return None
        
        if not user.stripe_customer_id:
            create_stripe_customer(user)
        
        session = stripe.checkout.Session.create(
            customer=user.stripe_customer_id,
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{
                "price": PLANS[plan_type]["price_id"],
                "quantity": 1
            }],
            success_url=os.environ.get("FRONTEND_URL", "http://localhost:5173") + "/billing?success=true",
            cancel_url=os.environ.get("FRONTEND_URL", "http://localhost:5173") + "/billing?canceled=true",
            metadata={"user_id": user.id, "plan": plan_type}
        )
        return session
    except stripe.error.StripeError as e:
        return None

def get_subscription_status(user):
    """Get user's subscription status"""
    if not user.stripe_subscription_id:
        return {"plan": "free", "status": "inactive", "current_period_end": None}
    
    try:
        subscription = stripe.Subscription.retrieve(user.stripe_subscription_id)
        plan_type = next((k for k, v in PLANS.items() if v.get("price_id") == subscription.items.data[0].price.id), "free")
        
        return {
            "plan": plan_type,
            "status": subscription.status,
            "current_period_end": subscription.current_period_end,
            "cancel_at_period_end": subscription.cancel_at_period_end
        }
    except stripe.error.StripeError:
        return {"plan": "free", "status": "inactive", "current_period_end": None}

def cancel_subscription(user):
    """Cancel user's subscription"""
    try:
        if user.stripe_subscription_id:
            stripe.Subscription.modify(
                user.stripe_subscription_id,
                cancel_at_period_end=True
            )
            return True
    except stripe.error.StripeError:
        pass
    return False

def get_portal_limit(user):
    """Get portal creation limit based on subscription"""
    plan = PLANS.get(user.subscription_status or "free", PLANS["free"])
    return plan.get("portals", 2)

def handle_webhook(event):
    """Handle Stripe webhooks"""
    try:
        if event["type"] == "customer.subscription.updated":
            data = event["data"]["object"]
            user = User.query.filter_by(stripe_subscription_id=data["id"]).first()
            if user:
                plan_id = data["items"].data[0].price.id
                plan_type = next((k for k, v in PLANS.items() if v.get("price_id") == plan_id), "free")
                user.subscription_status = data["status"]
                db.session.commit()
        
        elif event["type"] == "customer.subscription.deleted":
            data = event["data"]["object"]
            user = User.query.filter_by(stripe_subscription_id=data["id"]).first()
            if user:
                user.subscription_status = "canceled"
                user.stripe_subscription_id = ""
                db.session.commit()
        
        elif event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            user_id = session["metadata"].get("user_id")
            if user_id:
                user = User.query.get(user_id)
                if user and session.get("subscription"):
                    user.stripe_subscription_id = session["subscription"]
                    user.subscription_status = "active"
                    db.session.commit()
        
        return True
    except Exception as e:
        print(f"Webhook error: {e}")
        return False
