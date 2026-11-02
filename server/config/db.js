import mongoose from "mongoose";

let isConnected = false;

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chirp";

  // Connection options optimized for high-concurrency, low-latency persistent workloads
  const options = {
    maxPoolSize: 20, // maintain up to 20 socket connections for high concurrency
    minPoolSize: 5,  // keep at least 5 connections warm to eliminate cold handshake latency
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000,
    heartbeatFrequencyMS: 10000,
  };

  try {
    const conn = await mongoose.connect(mongoUri, options);
    isConnected = true;
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host} (${conn.connection.name})`);
  } catch (err) {
    isConnected = false;
    console.warn(`\n⚠️  [MongoDB Notice] Could not connect to MongoDB at: ${mongoUri}`);
    console.warn(`   Reason: ${err.message}`);
    console.warn(
      `   👉 Set your MONGO_URI in server/.env (e.g. from MongoDB Atlas or local MongoDB).\n`
    );
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
};

mongoose.connection.on("connected", () => {
  isConnected = true;
  console.log("[MongoDB] Connection pool established.");
});

mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.warn("[MongoDB] Connection lost. Attempting automatic reconnection...");
});

mongoose.connection.on("reconnected", () => {
  isConnected = true;
  console.log("[MongoDB] Connection re-established.");
});

mongoose.connection.on("error", (err) => {
  isConnected = false;
  console.error("[MongoDB] Connection error:", err.message);
});

export const isDbConnected = () => isConnected && mongoose.connection.readyState === 1;

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("[MongoDB] Disconnected gracefully.");
  }
};

export default connectDB;
