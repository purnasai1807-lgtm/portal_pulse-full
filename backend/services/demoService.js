import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Profile from "../models/Profile.js";
import Subscription from "../models/Subscription.js";
import Application from "../models/Application.js";
import Notification from "../models/Notification.js";

function getEnv(name, fallback) {
  return String(process.env[name] || fallback).trim();
}

async function upsertAccount({
  fullName,
  email,
  password,
  role = "user",
  segment = "student",
  organization = ""
}) {
  const normalizedEmail = email.toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    const hashedPassword = await bcrypt.hash(password, 10);
    user = await User.create({
      fullName,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      segment,
      organization,
      isActive: true
    });
  }

  await Profile.findOneAndUpdate(
    { userId: user._id },
    {
      userId: user._id,
      fullName,
      email: normalizedEmail,
      phone: "9876543210",
      qualification: role === "admin" ? "Operations" : "B.Tech",
      institution: role === "admin" ? "PortalPulse HQ" : "Demo Engineering College",
      course: role === "admin" ? "SaaS Ops" : "Computer Science",
      graduationYear: "2026",
      targetRole: role === "admin" ? "Admin Lead" : "Graduate Trainee",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      address: "Demo workspace for PortalPulse Pro"
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Subscription.findOneAndUpdate(
    { userId: user._id },
    {
      userId: user._id,
      plan: "Pro",
      status: "active",
      expiresAt: new Date(Date.now() + 45 * 86400000),
      amountPaid: 19900,
      paymentHistory: [
        {
          orderId: `seed_${user._id}`,
          paymentId: `seedpay_${user._id}`,
          amount: 19900,
          paidAt: new Date()
        }
      ]
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return user;
}

async function seedApplications(userId) {
  const count = await Application.countDocuments({ userId });

  if (count > 0) {
    return;
  }

  const baseDate = new Date();
  const applications = [
    {
      title: "Campus Placement Drive",
      portalName: "ABC Engineering College",
      deadline: new Date(baseDate.getTime() + 2 * 86400000),
      status: "Pending",
      notes: "Resume version 4 and aptitude prep",
      alertEnabled: true
    },
    {
      title: "Scholarship Renewal",
      portalName: "State Scholarship Portal",
      deadline: new Date(baseDate.getTime() + 4 * 86400000),
      status: "Applied",
      notes: "Income certificate uploaded",
      alertEnabled: true
    },
    {
      title: "Coaching Center Admission",
      portalName: "Prime Prep Academy",
      deadline: new Date(baseDate.getTime() + 9 * 86400000),
      status: "Approved",
      notes: "Demo converted to paid lead",
      alertEnabled: false
    }
  ];

  await Application.insertMany(applications.map((item) => ({ ...item, userId })));
}

async function seedNotifications(userId) {
  const count = await Notification.countDocuments({ userId });

  if (count > 0) {
    return;
  }

  await Notification.insertMany([
    {
      userId,
      title: "Demo workspace is ready",
      message: "Review the seeded applications, pricing, and admin analytics before your client demo.",
      channel: "system",
      type: "demo",
      status: "sent",
      sentAt: new Date()
    },
    {
      userId,
      title: "Pro plan activated",
      message: "This demo account includes Pro features so you can show premium autofill and unlimited reminders.",
      channel: "system",
      type: "payment",
      status: "sent",
      sentAt: new Date()
    }
  ]);
}

export async function ensureSeedAccounts() {
  if (String(process.env.ENABLE_DEMO_MODE || "true") !== "true") {
    return null;
  }

  const demoUser = await upsertAccount({
    fullName: "Demo Student",
    email: getEnv("DEMO_USER_EMAIL", "demo@portalpulse.pro"),
    password: getEnv("DEMO_USER_PASSWORD", "Demo123!"),
    role: "user",
    segment: "student",
    organization: "PortalPulse Demo"
  });

  await upsertAccount({
    fullName: "PortalPulse Admin",
    email: getEnv("DEMO_ADMIN_EMAIL", "admin@portalpulse.pro"),
    password: getEnv("DEMO_ADMIN_PASSWORD", "Admin123!"),
    role: "admin",
    segment: "college",
    organization: "PortalPulse Demo"
  });

  await seedApplications(demoUser._id);
  await seedNotifications(demoUser._id);

  return {
    demoEmail: getEnv("DEMO_USER_EMAIL", "demo@portalpulse.pro"),
    demoPassword: getEnv("DEMO_USER_PASSWORD", "Demo123!"),
    adminEmail: getEnv("DEMO_ADMIN_EMAIL", "admin@portalpulse.pro"),
    adminPassword: getEnv("DEMO_ADMIN_PASSWORD", "Admin123!")
  };
}
