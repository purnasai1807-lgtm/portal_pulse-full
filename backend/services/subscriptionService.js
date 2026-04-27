import Subscription from "../models/Subscription.js";

function getEnvNumber(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPlanLimits() {
  return {
    free: {
      applications: getEnvNumber("FREE_APPLICATION_LIMIT", 10),
      alerts: getEnvNumber("FREE_ALERT_LIMIT", 3)
    },
    pro: {
      applications: Number.MAX_SAFE_INTEGER,
      alerts: Number.MAX_SAFE_INTEGER
    }
  };
}

export async function getEffectiveSubscription(userId) {
  let subscription = await Subscription.findOne({ userId });

  if (!subscription) {
    subscription = await Subscription.create({
      userId,
      plan: "Free",
      status: "inactive"
    });
  }

  if (
    subscription.plan === "Pro" &&
    subscription.status === "active" &&
    subscription.expiresAt &&
    subscription.expiresAt.getTime() < Date.now()
  ) {
    subscription.plan = "Free";
    subscription.status = "expired";
    await subscription.save();
  }

  return subscription;
}

export function getFeatureAccess(subscription) {
  const isPro = subscription?.plan === "Pro" && subscription?.status === "active";
  const planLimits = getPlanLimits();
  const limits = isPro ? planLimits.pro : planLimits.free;

  return {
    plan: isPro ? "Pro" : "Free",
    status: isPro ? "active" : "inactive",
    limits,
    features: {
      autofillEnabled: isPro,
      unlimitedAlerts: isPro,
      pushNotifications: true,
      analyticsDashboard: true,
      notificationHistory: true
    },
    renewalPrice: getEnvNumber("PRO_PLAN_AMOUNT", 19900),
    expiresAt: subscription?.expiresAt || null
  };
}
