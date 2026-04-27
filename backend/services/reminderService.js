import Application from "../models/Application.js";
import Profile from "../models/Profile.js";
import User from "../models/User.js";
import { sendEmail } from "./emailService.js";
import { getEffectiveSubscription, getFeatureAccess } from "./subscriptionService.js";
import { recordNotification, sendPushNotification } from "./notificationService.js";

const REMINDER_MARKERS = [
  { days: 3, key: "deadline-3-days" },
  { days: 1, key: "deadline-1-day" },
  { days: 0, key: "deadline-today" }
];

function getDaysUntil(deadline) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function buildReminderEmail({ fullName, title, portalName, deadline, status }) {
  const prettyDate = new Date(deadline).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  return {
    subject: `PortalPulse reminder: ${title} closes on ${prettyDate}`,
    text: `Hi ${fullName || "there"}, your application "${title}" on ${portalName} is currently ${status} and closes on ${prettyDate}. Log in to PortalPulse Pro to review notes and next steps.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:18px">
        <h2 style="margin:0 0 12px;color:#f8fafc">PortalPulse Pro</h2>
        <p style="margin:0 0 16px">Hi ${fullName || "there"},</p>
        <p style="margin:0 0 16px">Your application <strong>${title}</strong> on <strong>${portalName}</strong> is marked <strong>${status}</strong>.</p>
        <p style="margin:0 0 16px">Deadline: <strong>${prettyDate}</strong></p>
        <p style="margin:0">Open your dashboard to review notes, update status, or prepare your next action.</p>
      </div>
    `
  };
}

export async function processDeadlineReminders() {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  threeDaysFromNow.setHours(23, 59, 59, 999);

  const applications = await Application.find({
    alertEnabled: true,
    status: { $in: ["Pending", "Applied"] },
    deadline: { $gte: new Date(), $lte: threeDaysFromNow }
  }).sort({ deadline: 1 });

  let remindersSent = 0;

  for (const application of applications) {
    const subscription = await getEffectiveSubscription(application.userId);
    const access = getFeatureAccess(subscription);
    const daysUntil = getDaysUntil(application.deadline);
    const marker = REMINDER_MARKERS.find((item) => item.days === daysUntil);

    if (!marker) {
      continue;
    }

    if (application.reminderHistory.some((entry) => entry.key === marker.key)) {
      continue;
    }

    const [user, profile] = await Promise.all([
      User.findById(application.userId).select("email fullName"),
      Profile.findOne({ userId: application.userId }).select("fullName email")
    ]);

    const recipient = profile?.email || user?.email;
    const reminderMessage = `${application.title} on ${application.portalName} closes soon. Review the deadline and next steps in PortalPulse Pro.`;

    let emailSent = false;

    if (recipient && profile?.notificationPreferences?.emailReminders !== false) {
      const email = buildReminderEmail({
        fullName: profile?.fullName || user?.fullName,
        title: application.title,
        portalName: application.portalName,
        deadline: application.deadline,
        status: application.status
      });

      try {
        const result = await sendEmail({
          to: recipient,
          subject: email.subject,
          text: email.text,
          html: email.html
        });

        await recordNotification({
          userId: application.userId,
          applicationId: application._id,
          title: email.subject,
          message: reminderMessage,
          channel: "email",
          type: "reminder",
          status: result.sent ? "sent" : "failed",
          metadata: result
        });

        emailSent = Boolean(result.sent);
      } catch (error) {
        await recordNotification({
          userId: application.userId,
          applicationId: application._id,
          title: `Reminder failed for ${application.title}`,
          message: reminderMessage,
          channel: "email",
          type: "reminder",
          status: "failed",
          metadata: { reason: error.message }
        });
      }
    }

    const pushSent = access.features.pushNotifications
      ? await sendPushNotification({
          userId: application.userId,
          applicationId: application._id,
          title: `Deadline reminder: ${application.title}`,
          message: reminderMessage,
          type: "reminder",
          data: {
            applicationId: application._id.toString(),
            portalName: application.portalName
          }
        })
      : { sent: false };

    if (emailSent || pushSent.sent) {
      application.reminderHistory.push({
        key: marker.key,
        sentAt: new Date()
      });

      await application.save();
      remindersSent += 1;
    }
  }

  return { remindersSent, scanned: applications.length };
}
