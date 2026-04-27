import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let memoryServer;

export async function connectDB() {
  let mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MONGODB_URI is missing");
    }

    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: "portalpulse-dev"
      }
    });
    mongoUri = memoryServer.getUri();
    console.log("Using in-memory MongoDB for local development");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
  return mongoose.connection;
}
