import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    },
    isActive: {
      type: Boolean,
      default: true
    },
    organization: {
      type: String,
      trim: true,
      default: ""
    },
    segment: {
      type: String,
      enum: ["student", "college", "coaching", "other"],
      default: "student"
    },
    lastSeenAt: Date,
    lastLoginAt: Date
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
