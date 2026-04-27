import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { authMiddleware } from "../middleware/authMiddleware.js";
import Subscription from "../models/Subscription.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getEffectiveSubscription, getFeatureAccess } from "../services/subscriptionService.js";
import { recordNotification } from "../services/notificationService.js";

const router = express.Router();

function getRazorpayClient() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

router.post(
  "/create-order",
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ message: "Razorpay is not configured on the server" });
    }

    const amount = Number(process.env.PRO_PLAN_AMOUNT || 19900);
    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `portalpulse_${req.userId}_${Date.now()}`
    });

    await Subscription.findOneAndUpdate(
      { userId: req.userId },
      {
        userId: req.userId,
        razorpayOrderId: order.id
      },
      { upsert: true, new: true }
    );

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID
    });
  })
);

router.post(
  "/verify",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification fields" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    const amount = Number(process.env.PRO_PLAN_AMOUNT || 19900);

    const subscription = await Subscription.findOneAndUpdate(
      { userId: req.userId },
      {
        $set: {
          plan: "Pro",
          status: "active",
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          expiresAt,
          amountPaid: amount
        },
        $push: {
          paymentHistory: {
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            amount,
            paidAt: new Date()
          }
        }
      },
      { upsert: true, new: true }
    );

    await recordNotification({
      userId: req.userId,
      title: "Pro plan activated",
      message: "Your PortalPulse Pro subscription is active for the next 30 days.",
      channel: "system",
      type: "payment",
      status: "sent",
      metadata: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount
      }
    });

    res.json({
      message: "Payment verified. Pro plan activated.",
      subscription,
      access: getFeatureAccess(subscription)
    });
  })
);

router.get(
  "/status",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const subscription = await getEffectiveSubscription(req.userId);
    const access = getFeatureAccess(subscription);
    const expiresInDays = subscription.expiresAt
      ? Math.max(0, Math.ceil((subscription.expiresAt.getTime() - Date.now()) / 86400000))
      : null;

    res.json({
      ...subscription.toObject(),
      access,
      expiresInDays
    });
  })
);

export default router;
