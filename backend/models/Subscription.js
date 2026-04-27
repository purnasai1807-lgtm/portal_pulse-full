import mongoose from "mongoose";

const paymentHistorySchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      trim: true,
      default: ""
    },
    paymentId: {
      type: String,
      trim: true,
      default: ""
    },
    amount: {
      type: Number,
      default: 0
    },
    paidAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    plan: { type: String, enum: ["Free", "Pro"], default: "Free" },
    status: { type: String, enum: ["inactive", "active", "expired", "cancelled"], default: "inactive" },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    expiresAt: Date,
    amountPaid: {
      type: Number,
      default: 0
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "manual"],
      default: "monthly"
    },
    paymentHistory: {
      type: [paymentHistorySchema],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.model("Subscription", subscriptionSchema);
