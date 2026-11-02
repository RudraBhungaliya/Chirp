import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    userName: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username must be at most 30 characters"],
    },

    displayName: {
      type: String,
      trim: true,
      maxlength: [50, "Display name must be at most 50 characters"],
      default: "Chirp User",
    },

    avatar: {
      type: String,
      default: "",
    },

    bio: {
      type: String,
      maxlength: [160, "Bio must be at most 160 characters"],
      default: "Hey there! I am using Chirp.",
    },

    isProfileComplete: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// High performance compound indexes for fast search and presence lookups
userSchema.index({ displayName: 1, userName: 1 });
userSchema.index({ isActive: 1, lastSeen: -1 });

export default mongoose.model("User", userSchema);
