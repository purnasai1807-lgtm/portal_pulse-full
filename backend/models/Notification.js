import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    channel: {
      type: String,
      enum: ["system", "email", "push"],
      default: "system",
      index: true
    },
    type: {
      type: String,
      enum: ["reminder", "payment", "system", "demo", "admin"],
      default: "system",
      index: true
    },
    status: {
      type: String,
      enum: ["queued", "sent", "failed", "read"],
      default: "sent"
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    readAt: Date
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
