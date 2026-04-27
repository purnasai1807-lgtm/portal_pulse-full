import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Application from "../models/Application.js";
import { getEffectiveSubscription, getFeatureAccess } from "../services/subscriptionService.js";
import { validateApplicationPayload } from "../utils/validation.js";

const router = express.Router();

function serializeApplication(application) {
  return {
    id: application._id,
    title: application.title,
    portalName: application.portalName,
    deadline: application.deadline,
    status: application.status,
    notes: application.notes,
    alertEnabled: application.alertEnabled,
    reminderHistory: application.reminderHistory,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt
  };
}

async function enforceApplicationLimits({ userId, alertEnabled, existingApplicationId }) {
  const subscription = await getEffectiveSubscription(userId);
  const access = getFeatureAccess(subscription);

  const applicationCount = await Application.countDocuments({ userId });

  if (!existingApplicationId && applicationCount >= access.limits.applications) {
    return {
      ok: false,
      status: 403,
      message: `Free plan supports up to ${access.limits.applications} tracked applications. Upgrade to Pro for unlimited tracking.`,
      access
    };
  }

  if (alertEnabled) {
    const activeAlertCount = await Application.countDocuments({
      userId,
      alertEnabled: true,
      ...(existingApplicationId ? { _id: { $ne: existingApplicationId } } : {})
    });

    if (activeAlertCount >= access.limits.alerts) {
      return {
        ok: false,
        status: 403,
        message: `Free plan supports alerts on ${access.limits.alerts} applications. Upgrade to Pro for unlimited reminders.`,
        access
      };
    }
  }

  return { ok: true, access };
}

function buildAnalytics(applications) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    return {
      key,
      label: date.toLocaleDateString("en-IN", { month: "short" }),
      submitted: 0,
      approved: 0,
      rejected: 0,
      applied: 0
    };
  });

  const monthMap = new Map(months.map((item) => [item.key, item]));
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

  applications.forEach((application) => {
    const created = new Date(application.createdAt);
    const monthKey = `${created.getFullYear()}-${created.getMonth()}`;
    const month = monthMap.get(monthKey);

    if (month) {
      month.submitted += 1;
      if (application.status === "Applied") {
        month.applied += 1;
      }
      if (application.status === "Approved") {
        month.approved += 1;
      }
      if (application.status === "Rejected") {
        month.rejected += 1;
      }
    }

    statusCounts[application.status] += 1;

    const deadline = new Date(application.deadline);
    const daysUntil = Math.ceil((deadline.getTime() - Date.now()) / 86400000);

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

  const total = applications.length;
  const approved = statusCounts.Approved;

  return {
    trend: months,
    statusBreakdown: Object.entries(statusCounts).map(([label, value]) => ({ label, value })),
    deadlineBuckets: Object.entries(deadlineBuckets).map(([label, value]) => ({ label, value })),
    summary: {
      total,
      successRate: total ? Math.round((approved / total) * 100) : 0,
      upcoming: applications.filter(
        (item) =>
          new Date(item.deadline).getTime() >= Date.now() &&
          new Date(item.deadline).getTime() <= Date.now() + 7 * 86400000
      ).length
    }
  };
}

router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { search = "", status = "all" } = req.query;
    const filters = { userId: req.userId };

    if (status !== "all") {
      filters.status = status;
    }

    if (search.trim()) {
      filters.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { portalName: { $regex: search.trim(), $options: "i" } },
        { notes: { $regex: search.trim(), $options: "i" } }
      ];
    }

    const [applications, subscription] = await Promise.all([
      Application.find(filters).sort({ deadline: 1, createdAt: -1 }),
      getEffectiveSubscription(req.userId)
    ]);

    const access = getFeatureAccess(subscription);
    const summary = {
      total: applications.length,
      pending: applications.filter((item) => item.status === "Pending").length,
      applied: applications.filter((item) => item.status === "Applied").length,
      approved: applications.filter((item) => item.status === "Approved").length,
      rejected: applications.filter((item) => item.status === "Rejected").length,
      upcoming: applications.filter(
        (item) =>
          new Date(item.deadline).getTime() >= Date.now() &&
          new Date(item.deadline).getTime() <= Date.now() + 7 * 86400000
      ).length,
      successRate: applications.length
        ? Math.round(
            (applications.filter((item) => item.status === "Approved").length / applications.length) * 100
          )
        : 0
    };

    res.json({
      applications: applications.map(serializeApplication),
      summary,
      subscription: access
    });
  })
);

router.post(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { payload, errors } = validateApplicationPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const limitCheck = await enforceApplicationLimits({
      userId: req.userId,
      alertEnabled: Boolean(payload.alertEnabled)
    });

    if (!limitCheck.ok) {
      return res.status(limitCheck.status).json({ message: limitCheck.message, subscription: limitCheck.access });
    }

    const application = await Application.create({
      userId: req.userId,
      title: payload.title,
      portalName: payload.portalName,
      deadline: payload.deadline,
      status: payload.status,
      notes: payload.notes,
      alertEnabled: Boolean(payload.alertEnabled)
    });

    res.status(201).json({
      message: "Application added successfully",
      application: serializeApplication(application),
      subscription: limitCheck.access
    });
  })
);

router.get(
  "/analytics",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const applications = await Application.find({ userId: req.userId }).sort({ createdAt: 1 });
    res.json(buildAnalytics(applications));
  })
);

router.put(
  "/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const application = await Application.findOne({ _id: req.params.id, userId: req.userId });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const { payload, errors } = validateApplicationPayload(req.body, { partial: true });

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const desiredAlertEnabled =
      typeof req.body.alertEnabled === "boolean" ? req.body.alertEnabled : application.alertEnabled;

    const limitCheck = await enforceApplicationLimits({
      userId: req.userId,
      alertEnabled: desiredAlertEnabled,
      existingApplicationId: application._id
    });

    if (!limitCheck.ok) {
      return res.status(limitCheck.status).json({ message: limitCheck.message, subscription: limitCheck.access });
    }

    application.title = payload.title || application.title;
    application.portalName = payload.portalName || application.portalName;
    application.deadline = payload.deadline || application.deadline;
    application.status = payload.status || application.status;
    application.notes = payload.notes !== undefined ? payload.notes : application.notes;
    application.alertEnabled = desiredAlertEnabled;

    await application.save();

    res.json({
      message: "Application updated successfully",
      application: serializeApplication(application),
      subscription: limitCheck.access
    });
  })
);

router.delete(
  "/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const application = await Application.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    res.json({ message: "Application deleted successfully" });
  })
);

export default router;
