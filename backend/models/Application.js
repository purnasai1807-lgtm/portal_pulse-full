import mongoose from "mongoose";

const reminderHistorySchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    sentAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    portalName: {
      type: String,
      required: true,
      trim: true
    },
    deadline: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["Pending", "Applied", "Rejected", "Approved"],
      default: "Pending",
      index: true
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    },
    alertEnabled: {
      type: Boolean,
      default: true
    },
    reminderHistory: {
      type: [reminderHistorySchema],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.model("Application", applicationSchema);
