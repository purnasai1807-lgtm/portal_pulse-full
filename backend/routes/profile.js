import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Profile from "../models/Profile.js";
import User from "../models/User.js";
import { getEffectiveSubscription, getFeatureAccess } from "../services/subscriptionService.js";
import { requireFeature } from "../middleware/subscriptionMiddleware.js";
import { validateProfilePayload } from "../utils/validation.js";

const router = express.Router();

const allowedFields = [
  "fullName",
  "email",
  "phone",
  "dob",
  "qualification",
  "institution",
  "course",
  "graduationYear",
  "targetRole",
  "address",
  "city",
  "state",
  "pincode"
];

function pickProfilePayload(body) {
  return allowedFields.reduce((accumulator, field) => {
    accumulator[field] = String(body[field] ?? "").trim();
    return accumulator;
  }, {});
}

router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const profile = await Profile.findOne({ userId: req.userId });
    const subscription = await getEffectiveSubscription(req.userId);

    res.json({
      profile,
      subscription: getFeatureAccess(subscription)
    });
  })
);

router.put(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { payload, preferences, errors } = validateProfilePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const profile = await Profile.findOneAndUpdate(
      { userId: req.userId },
      {
        ...pickProfilePayload(payload),
        notificationPreferences: preferences
      },
      { new: true, upsert: true, runValidators: true }
    );

    await User.findByIdAndUpdate(req.userId, {
      fullName: payload.fullName,
      email: payload.email.toLowerCase()
    });

    res.json({
      message: "Profile updated successfully",
      profile
    });
  })
);

router.get(
  "/extension",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const [profile, subscription] = await Promise.all([
      Profile.findOne({ userId: req.userId }),
      getEffectiveSubscription(req.userId)
    ]);
    const access = getFeatureAccess(subscription);

    res.json({
      profile,
      access
    });
  })
);

router.get(
  "/autofill",
  authMiddleware,
  requireFeature("autofillEnabled"),
  asyncHandler(async (req, res) => {
    const profile = await Profile.findOne({ userId: req.userId });

    res.json({
      profile
    });
  })
);

export default router;
