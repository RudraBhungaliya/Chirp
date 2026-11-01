import mongoose from "mongoose";

const connectDB = async () => {
  const mongoUri =
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chirp";

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB Connected ✅ (${conn.connection.host})`);
  } catch (err) {
    console.warn(`\n⚠️  [MongoDB Warning] Could not connect to MongoDB at: ${mongoUri}`);
    console.warn(`   Reason: ${err.message}`);
    console.warn(
      `   👉 Set your MONGO_URI in server/.env (e.g. from MongoDB Atlas or local MongoDB).\n`
    );
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
};

export default connectDB;
