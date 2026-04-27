import express from "express";
import Notification from "../models/Notification.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isValidExpoPushToken, sanitizeString } from "../utils/validation.js";
import { registerPushToken } from "../services/notificationService.js";

const router = express.Router();

function serializeNotification(item) {
  return {
    id: item._id,
    title: item.title,
    message: item.message,
    channel: item.channel,
    type: item.type,
    status: item.status,
    sentAt: item.sentAt,
    readAt: item.readAt,
    applicationId: item.applicationId,
    metadata: item.metadata || {}
  };
}

router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const items = await Notification.find({ userId: req.userId }).sort({ sentAt: -1 }).limit(100);
    const unreadCount = await Notification.countDocuments({
      userId: req.userId,
      readAt: { $exists: false }
    });

    res.json({
      items: items.map(serializeNotification),
      unreadCount
    });
  })
);

router.patch(
  "/read-all",
  authMiddleware,
  asyncHandler(async (req, res) => {
    await Notification.updateMany(
      { userId: req.userId, readAt: { $exists: false } },
      {
        status: "read",
        readAt: new Date()
      }
    );

    res.json({ message: "Notifications marked as read" });
  })
);

router.patch(
  "/:id/read",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      {
        status: "read",
        readAt: new Date()
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({
      message: "Notification updated",
      notification: serializeNotification(notification)
    });
  })
);

router.post(
  "/push-token",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const token = sanitizeString(req.body.token, 200);
    const platform = sanitizeString(req.body.platform || "unknown", 20) || "unknown";
    const deviceName = sanitizeString(req.body.deviceName, 120);

    if (!isValidExpoPushToken(token)) {
      return res.status(400).json({ message: "A valid Expo push token is required" });
    }

    const pushTokens = await registerPushToken({
      userId: req.userId,
      token,
      platform,
      deviceName
    });

    res.json({
      message: "Push notifications enabled",
      pushTokens
    });
  })
);

export default router;
