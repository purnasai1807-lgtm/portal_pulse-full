import express from "express";
import bcrypt from "bcryptjs";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateToken } from "../utils/generateToken.js";
import User from "../models/User.js";
import Profile from "../models/Profile.js";
import Subscription from "../models/Subscription.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getEffectiveSubscription, getFeatureAccess } from "../services/subscriptionService.js";
import { normalizeEmail, isValidEmail, sanitizeString } from "../utils/validation.js";

const router = express.Router();
const allowedSegments = ["student", "college", "coaching", "other"];

function sanitizeUser(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role
  };
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const fullName = sanitizeString(req.body.fullName, 120);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "").trim();
    const organization = sanitizeString(req.body.organization, 160);
    const segmentInput = sanitizeString(req.body.segment || "student", 40) || "student";
    const segment = allowedSegments.includes(segmentInput) ? segmentInput : "student";

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Full name, email, and password are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "A valid email address is required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ message: "An account already exists for this email" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role =
      process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase()
        ? "admin"
        : "user";

    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role,
      organization,
      segment
    });

    await Promise.all([
      Profile.create({
        userId: user._id,
        fullName,
        email,
        organization
      }),
      Subscription.create({
        userId: user._id,
        plan: "Free",
        status: "inactive"
      })
    ]);

    const token = generateToken(user._id.toString());
    const subscription = await getEffectiveSubscription(user._id);

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: sanitizeUser(user),
      subscription: getFeatureAccess(subscription)
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const normalizedEmail = normalizeEmail(req.body.email);
    const password = String(req.body.password || "").trim();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "This account has been deactivated. Contact PortalPulse support." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    user.lastLoginAt = new Date();
    user.lastSeenAt = new Date();
    await user.save();

    const token = generateToken(user._id.toString());
    const subscription = await getEffectiveSubscription(user._id);

    res.json({
      message: "Login successful",
      token,
      user: sanitizeUser(user),
      subscription: getFeatureAccess(subscription)
    });
  })
);

router.post(
  "/demo",
  asyncHandler(async (req, res) => {
    if (String(process.env.ENABLE_DEMO_MODE || "true") !== "true") {
      return res.status(404).json({ message: "Demo mode is disabled" });
    }

    const demoEmail = normalizeEmail(process.env.DEMO_USER_EMAIL || "demo@portalpulse.pro");
    const user = await User.findOne({ email: demoEmail });

    if (!user || !user.isActive) {
      return res.status(404).json({ message: "Demo account is unavailable" });
    }

    const subscription = await getEffectiveSubscription(user._id);

    res.json({
      message: "Demo session started",
      token: generateToken(user._id.toString()),
      user: sanitizeUser(user),
      subscription: getFeatureAccess(subscription),
      demoMode: true
    });
  })
);

router.post("/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const subscription = await getEffectiveSubscription(req.userId);
    const profile = await Profile.findOne({ userId: req.userId });

    res.json({
      user: sanitizeUser(req.user),
      profile,
      subscription: getFeatureAccess(subscription),
      demoMode: String(process.env.ENABLE_DEMO_MODE || "true") === "true"
    });
  })
);

export default router;
