import "dotenv/config";
import cron from "node-cron";
import { connectDB } from "./config/db.js";
import { processDeadlineReminders } from "./services/reminderService.js";

async function runWorker() {
  await connectDB();

  console.log("PortalPulse Pro reminder worker started");

  cron.schedule("0 * * * *", async () => {
    try {
      const result = await processDeadlineReminders();
      console.log("Reminder worker tick", result);
    } catch (error) {
      console.error("Reminder worker failed", error.message);
    }
  });
}

runWorker().catch((error) => {
  console.error("Worker failed to start", error);
  process.exit(1);
});
