import Notification from "../models/Notification.js";
import Profile from "../models/Profile.js";

export async function recordNotification({
  userId,
  applicationId = null,
  title,
  message,
  channel = "system",
  type = "system",
  status = "sent",
  metadata = {}
}) {
  return Notification.create({
    userId,
    applicationId,
    title,
    message,
    channel,
    type,
    status,
    metadata,
    sentAt: new Date(),
    readAt: status === "read" ? new Date() : undefined
  });
}

export async function registerPushToken({
  userId,
  token,
  platform = "unknown",
  deviceName = ""
}) {
  const profile =
    (await Profile.findOne({ userId })) ||
    (await Profile.create({
      userId,
      fullName: "",
      email: "",
      pushTokens: []
    }));

  const withoutToken = (profile.pushTokens || []).filter((entry) => entry.token !== token);
  withoutToken.push({
    token,
    platform,
    deviceName,
    updatedAt: new Date()
  });

  profile.pushTokens = withoutToken.slice(-5);
  await profile.save();
  return profile.pushTokens;
}

export async function sendPushNotification({
  userId,
  applicationId = null,
  title,
  message,
  type = "system",
  data = {}
}) {
  const profile = await Profile.findOne({ userId }).select("pushTokens notificationPreferences");

  if (!profile?.notificationPreferences?.pushReminders) {
    await recordNotification({
      userId,
      applicationId,
      title,
      message,
      channel: "push",
      type,
      status: "failed",
      metadata: { reason: "Push reminders disabled" }
    });

    return { sent: false, reason: "Push reminders disabled" };
  }

  const tokens = (profile.pushTokens || []).map((entry) => entry.token).filter(Boolean);

  if (tokens.length === 0) {
    await recordNotification({
      userId,
      applicationId,
      title,
      message,
      channel: "push",
      type,
      status: "failed",
      metadata: { reason: "No registered push tokens" }
    });

    return { sent: false, reason: "No registered push tokens" };
  }

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        tokens.map((token) => ({
          to: token,
          title,
          body: message,
          sound: "default",
          data
        }))
      )
    });

    const payload = await response.json().catch(() => ({}));

    await recordNotification({
      userId,
      applicationId,
      title,
      message,
      channel: "push",
      type,
      status: response.ok ? "sent" : "failed",
      metadata: payload
    });

    return {
      sent: response.ok,
      payload
    };
  } catch (error) {
    await recordNotification({
      userId,
      applicationId,
      title,
      message,
      channel: "push",
      type,
      status: "failed",
      metadata: { reason: error.message }
    });

    return { sent: false, reason: error.message };
  }
}
