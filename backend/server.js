import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cron from "node-cron";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import applicationRoutes from "./routes/applications.js";
import subscriptionRoutes from "./routes/subscription.js";
import notificationRoutes from "./routes/notifications.js";
import adminRoutes from "./routes/admin.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { processDeadlineReminders } from "./services/reminderService.js";
import { ensureSeedAccounts } from "./services/demoService.js";
const app = express();
const port = Number(process.env.PORT || 5000);

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        process.env.NODE_ENV !== "production" ||
        allowedOrigins.includes(origin) ||
        origin.startsWith("chrome-extension://")
      ) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    }
  })
);
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "PortalPulse Pro API"
  });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDB();
  await ensureSeedAccounts();

  if (String(process.env.ENABLE_CRON || "true") === "true") {
    cron.schedule("0 * * * *", async () => {
      try {
        const result = await processDeadlineReminders();
        console.log("Reminder job completed", result);
      } catch (error) {
        console.error("Reminder job failed", error.message);
      }
    });
  }

  app.listen(port, () => {
    console.log(`PortalPulse Pro API running on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
