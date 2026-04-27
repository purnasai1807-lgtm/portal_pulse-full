import mongoose from "mongoose";

const pushTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      trim: true
    },
    platform: {
      type: String,
      enum: ["android", "ios", "web", "unknown"],
      default: "unknown"
    },
    deviceName: {
      type: String,
      trim: true,
      default: ""
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    fullName: {
      type: String,
      trim: true,
      default: ""
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    dob: {
      type: String,
      trim: true,
      default: ""
    },
    qualification: {
      type: String,
      trim: true,
      default: ""
    },
    institution: {
      type: String,
      trim: true,
      default: ""
    },
    course: {
      type: String,
      trim: true,
      default: ""
    },
    graduationYear: {
      type: String,
      trim: true,
      default: ""
    },
    targetRole: {
      type: String,
      trim: true,
      default: ""
    },
    address: {
      type: String,
      trim: true,
      default: ""
    },
    city: {
      type: String,
      trim: true,
      default: ""
    },
    state: {
      type: String,
      trim: true,
      default: ""
    },
    pincode: {
      type: String,
      trim: true,
      default: ""
    },
    pushTokens: {
      type: [pushTokenSchema],
      default: []
    },
    notificationPreferences: {
      emailReminders: {
        type: Boolean,
        default: true
      },
      pushReminders: {
        type: Boolean,
        default: true
      }
    }
  },
  { timestamps: true }
);

export default mongoose.model("Profile", profileSchema);
