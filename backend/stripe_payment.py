import os
import stripe
from models import db, User

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

# Subscription Plans
PLANS = {
    "free": {"price_id": None, "name": "Free", "portals": 2, "price": 0},
    "pro": {"price_id": os.environ.get("STRIPE_PRICE_PRO", ""), "name": "Pro", "portals": 50, "price": 29},
    "enterprise": {"price_id": os.environ.get("STRIPE_PRICE_ENTERPRISE", ""), "name": "Enterprise", "portals": 500, "price": 99}
}


def _plan_from_price_id(price_id):
    """Map a Stripe price ID back to our plan key."""
    for key, val in PLANS.items():
        if val.get("price_id") == price_id:
            return key
    return "free"


def create_stripe_customer(user):
    """Create a Stripe customer for a user."""
    try:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.name,
            metadata={"user_id": user.id}
        )
        user.stripe_customer_id = customer.id
        db.session.commit()
        return customer
    except stripe.error.StripeError:
        return None


def create_checkout_session(user, plan_type="pro"):
    """Create a Stripe checkout session."""
    try:
        plan = PLANS.get(plan_type)
        if not plan or not plan["price_id"]:
            return None

        if not user.stripe_customer_id:
            create_stripe_customer(user)

        checkout = stripe.checkout.Session.create(
            customer=user.stripe_customer_id,
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{
                "price": plan["price_id"],
                "quantity": 1
            }],
            success_url=os.environ.get("FRONTEND_URL", "http://localhost:5173") + "/billing?success=true",
            cancel_url=os.environ.get("FRONTEND_URL", "http://localhost:5173") + "/billing?canceled=true",
            metadata={"user_id": user.id, "plan": plan_type}
        )
        return checkout
    except stripe.error.StripeError:
        return None


def get_subscription_status(user):
    """Get user's subscription status from Stripe."""
    if not user.stripe_subscription_id:
        return {"plan": user.plan or "free", "status": "inactive", "current_period_end": None}

    try:
        subscription = stripe.Subscription.retrieve(user.stripe_subscription_id)
        price_id = subscription.items.data[0].price.id
        plan_type = _plan_from_price_id(price_id)

        return {
            "plan": plan_type,
            "status": subscription.status,
            "current_period_end": subscription.current_period_end,
            "cancel_at_period_end": subscription.cancel_at_period_end
        }
    except stripe.error.StripeError:
        return {"plan": user.plan or "free", "status": "inactive", "current_period_end": None}


def cancel_subscription(user):
    """Cancel user's subscription at period end."""
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
    """Get portal creation limit based on the user's plan."""
    plan = PLANS.get(user.plan or "free", PLANS["free"])
    return plan.get("portals", 2)


def handle_webhook(event):
    """Handle Stripe webhook events. Must be called inside Flask app context."""
    try:
        event_type = event.get("type", "")
        obj = event.get("data", {}).get("object", {})

        if event_type == "customer.subscription.updated":
            user = User.query.filter_by(stripe_subscription_id=obj.get("id")).first()
            if user:
                price_id = obj["items"]["data"][0]["price"]["id"]
                user.plan = _plan_from_price_id(price_id)
                user.subscription_status = obj.get("status", "inactive")
                db.session.commit()

        elif event_type == "customer.subscription.deleted":
            user = User.query.filter_by(stripe_subscription_id=obj.get("id")).first()
            if user:
                user.subscription_status = "canceled"
                user.plan = "free"
                user.stripe_subscription_id = ""
                db.session.commit()

        elif event_type == "checkout.session.completed":
            meta = obj.get("metadata", {})
            user_id = meta.get("user_id")
            plan_type = meta.get("plan", "pro")
            if user_id:
                user = User.query.get(int(user_id))
                if user and obj.get("subscription"):
                    user.stripe_subscription_id = obj["subscription"]
                    user.subscription_status = "active"
                    user.plan = plan_type
                    db.session.commit()

        elif event_type == "invoice.paid":
            user = User.query.filter_by(stripe_customer_id=obj.get("customer", "")).first()
            if user:
                user.subscription_status = "active"
                db.session.commit()

        elif event_type == "invoice.payment_failed":
            user = User.query.filter_by(stripe_customer_id=obj.get("customer", "")).first()
            if user:
                user.subscription_status = "past_due"
                db.session.commit()

        return True
    except Exception as e:
        print(f"Webhook error: {e}")
        db.session.rollback()
        return False
