import { getEffectiveSubscription, getFeatureAccess } from "../services/subscriptionService.js";

async function ensureSubscriptionAccess(req) {
  if (req.subscriptionAccess) {
    return req.subscriptionAccess;
  }

  const subscription = await getEffectiveSubscription(req.userId);
  req.subscription = subscription;
  req.subscriptionAccess = getFeatureAccess(subscription);
  return req.subscriptionAccess;
}

export async function attachSubscriptionAccess(req, res, next) {
  try {
    await ensureSubscriptionAccess(req);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireFeature(featureName) {
  return async (req, res, next) => {
    const access = await ensureSubscriptionAccess(req);

    if (!access.features?.[featureName]) {
      return res.status(403).json({
        message: "This feature requires an active Pro subscription",
        subscription: access
      });
    }

    next();
  };
}
