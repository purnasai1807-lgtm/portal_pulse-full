import express from "express";
import User from "../models/User.js";
import Profile from "../models/Profile.js";
import Application from "../models/Application.js";
import Subscription from "../models/Subscription.js";
import Notification from "../models/Notification.js";
import { authMiddleware, requireAdmin } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sanitizeString } from "../utils/validation.js";

const router = express.Router();

function getMonthSeries(length = 6) {
  const now = new Date();
  return Array.from({ length }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (length - 1 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString("en-IN", { month: "short" }),
      value: 0
    };
  });
}

function sumRevenue(subscriptions) {
  return subscriptions.reduce(
    (total, subscription) =>
      total +
      (subscription.paymentHistory || []).reduce((accumulator, payment) => accumulator + (payment.amount || 0), 0),
    0
  );
}

router.use(authMiddleware, requireAdmin);

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const [users, applications, subscriptions, notifications, recentApplications] = await Promise.all([
      User.find().sort({ createdAt: -1 }),
      Application.find().sort({ createdAt: -1 }),
      Subscription.find(),
      Notification.find().sort({ sentAt: -1 }).limit(12),
      Application.find().populate("userId", "fullName email organization").sort({ createdAt: -1 }).limit(8)
    ]);

    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const sixMonthUsers = getMonthSeries();
    const sixMonthRevenue = getMonthSeries();
    const userSeriesMap = new Map(sixMonthUsers.map((item) => [item.key, item]));
    const revenueSeriesMap = new Map(sixMonthRevenue.map((item) => [item.key, item]));
    const statusCounts = {
      Pending: 0,
      Applied: 0,
      Approved: 0,
      Rejected: 0
    };
    const deadlineBuckets = {
      Overdue: 0,
      "1-3 days": 0,
      "4-7 days": 0,
      "8+ days": 0
    };

    users.forEach((user) => {
      const key = `${user.createdAt.getFullYear()}-${user.createdAt.getMonth()}`;
      const bucket = userSeriesMap.get(key);
      if (bucket) {
        bucket.value += 1;
      }
    });

    subscriptions.forEach((subscription) => {
      (subscription.paymentHistory || []).forEach((payment) => {
        const paidAt = new Date(payment.paidAt);
        const key = `${paidAt.getFullYear()}-${paidAt.getMonth()}`;
        const bucket = revenueSeriesMap.get(key);
        if (bucket) {
          bucket.value += payment.amount || 0;
        }
      });
    });

    applications.forEach((application) => {
      statusCounts[application.status] += 1;
      const daysUntil = Math.ceil((new Date(application.deadline).getTime() - Date.now()) / 86400000);

      if (daysUntil < 0) {
        deadlineBuckets.Overdue += 1;
      } else if (daysUntil <= 3) {
        deadlineBuckets["1-3 days"] += 1;
      } else if (daysUntil <= 7) {
        deadlineBuckets["4-7 days"] += 1;
      } else {
        deadlineBuckets["8+ days"] += 1;
      }
    });

    const activeUsers = users.filter((user) => user.isActive).length;
    const proUsers = subscriptions.filter((subscription) => subscription.plan === "Pro" && subscription.status === "active").length;
    const recentUsers = users.slice(0, 8).map((user) => ({
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      organization: user.organization,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    }));

    res.json({
      metrics: {
        totalUsers: users.length,
        activeUsers,
        inactiveUsers: users.length - activeUsers,
        activeUsers30d: users.filter((user) => user.lastLoginAt && user.lastLoginAt.getTime() >= thirtyDaysAgo).length,
        proUsers,
        freeUsers: Math.max(users.length - proUsers, 0),
        totalApplications: applications.length,
        upcomingDeadlines: applications.filter(
          (application) =>
            new Date(application.deadline).getTime() >= Date.now() &&
            new Date(application.deadline).getTime() <= Date.now() + 7 * 86400000
        ).length,
        revenueInr: sumRevenue(subscriptions),
        remindersSent: notifications.filter((item) => item.type === "reminder" && item.status === "sent").length,
        conversionRate: users.length ? Math.round((proUsers / users.length) * 100) : 0
      },
      charts: {
        userGrowth: sixMonthUsers,
        revenueGrowth: sixMonthRevenue,
        applicationStatus: Object.entries(statusCounts).map(([label, value]) => ({ label, value })),
        deadlineBuckets: Object.entries(deadlineBuckets).map(([label, value]) => ({ label, value }))
      },
      recentUsers,
      recentApplications: recentApplications.map((application) => ({
        id: application._id,
        title: application.title,
        portalName: application.portalName,
        status: application.status,
        deadline: application.deadline,
        user: application.userId
          ? {
              fullName: application.userId.fullName,
              email: application.userId.email,
              organization: application.userId.organization
            }
          : null
      }))
    });
  })
);

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const search = sanitizeString(req.query.search, 120).toLowerCase();
    const status = sanitizeString(req.query.status || "all", 20).toLowerCase();
    const plan = sanitizeString(req.query.plan || "all", 20);

    const users = await User.find().sort({ createdAt: -1 });
    const profiles = await Profile.find({
      userId: { $in: users.map((user) => user._id) }
    });
    const subscriptions = await Subscription.find({
      userId: { $in: users.map((user) => user._id) }
    });
    const applicationCounts = await Application.aggregate([
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 }
        }
      }
    ]);

    const profileMap = new Map(profiles.map((profile) => [String(profile.userId), profile]));
    const subscriptionMap = new Map(subscriptions.map((subscription) => [String(subscription.userId), subscription]));
    const applicationMap = new Map(applicationCounts.map((item) => [String(item._id), item.count]));

    const results = users
      .map((user) => {
        const profile = profileMap.get(String(user._id));
        const subscription = subscriptionMap.get(String(user._id));
        return {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          organization: user.organization || profile?.institution || "",
          segment: user.segment,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          plan: subscription?.plan || "Free",
          subscriptionStatus: subscription?.status || "inactive",
          expiresAt: subscription?.expiresAt || null,
          applicationCount: applicationMap.get(String(user._id)) || 0
        };
      })
      .filter((user) => {
        const matchesSearch =
          !search ||
          [user.fullName, user.email, user.organization].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(search)
          );
        const matchesStatus =
          status === "all" || (status === "active" ? user.isActive : !user.isActive);
        const matchesPlan = plan === "all" || user.plan === plan;
        return matchesSearch && matchesStatus && matchesPlan;
      });

    res.json({ users: results });
  })
);

router.patch(
  "/users/:id/status",
  asyncHandler(async (req, res) => {
    const isActive = Boolean(req.body.isActive);

    if (req.params.id === req.userId && !isActive) {
      return res.status(400).json({ message: "You cannot deactivate your own admin account" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      user: {
        id: user._id,
        isActive: user.isActive
      }
    });
  })
);

router.patch(
  "/users/:id/subscription",
  asyncHandler(async (req, res) => {
    const plan = sanitizeString(req.body.plan || "Free", 10);
    const status = sanitizeString(req.body.status || (plan === "Pro" ? "active" : "inactive"), 20);
    const expiresAt =
      req.body.expiresAt && !Number.isNaN(new Date(req.body.expiresAt).getTime())
        ? new Date(req.body.expiresAt)
        : plan === "Pro" && status === "active"
          ? new Date(Date.now() + 30 * 86400000)
          : null;

    if (!["Free", "Pro"].includes(plan)) {
      return res.status(400).json({ message: "Plan must be Free or Pro" });
    }

    if (!["inactive", "active", "expired", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Subscription status is invalid" });
    }

    const subscription = await Subscription.findOneAndUpdate(
      { userId: req.params.id },
      {
        userId: req.params.id,
        plan,
        status,
        expiresAt,
        billingCycle: "manual",
        ...(plan === "Free"
          ? { amountPaid: 0 }
          : {})
      },
      { upsert: true, new: true }
    );

    res.json({
      message: "Subscription updated successfully",
      subscription
    });
  })
);

router.get(
  "/applications",
  asyncHandler(async (req, res) => {
    const search = sanitizeString(req.query.search, 120).toLowerCase();
    const status = sanitizeString(req.query.status || "all", 20);

    const applications = await Application.find(status === "all" ? {} : { status })
      .populate("userId", "fullName email organization")
      .sort({ deadline: 1, createdAt: -1 })
      .limit(200);

    const results = applications
      .filter((application) => {
        if (!search) {
          return true;
        }

        return [application.title, application.portalName, application.notes, application.userId?.fullName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      })
      .map((application) => ({
        id: application._id,
        title: application.title,
        portalName: application.portalName,
        deadline: application.deadline,
        status: application.status,
        notes: application.notes,
        alertEnabled: application.alertEnabled,
        user: application.userId
          ? {
              id: application.userId._id,
              fullName: application.userId.fullName,
              email: application.userId.email,
              organization: application.userId.organization
            }
          : null
      }));

    res.json({ applications: results });
  })
);

export default router;
