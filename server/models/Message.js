import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "document"],
      default: "text",
    },

    content: {
      type: String,
      default: "",
      trim: true,
      maxlength: [10000, "Message content cannot exceed 10000 characters"],
    },

    file: {
      name: String,
      mime: String,
      url: String,
      size: Number,
      expiresAt: Date,
    },

    // Client-generated UUID to match optimistic UI state immediately
    clientId: {
      type: String,
      index: true,
    },

    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },

    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for reverse-chronological cursor pagination (sub-millisecond retrieval)
messageSchema.index({ chatId: 1, createdAt: -1 });

// TTL expiration index for auto-purging temporary attachments
messageSchema.index({ "file.expiresAt": 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Message", messageSchema);
