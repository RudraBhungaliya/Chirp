import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    },
    file: {
      name: String,
      mime: String,
      url: String,
      expiresAt: Date,
    },
    // optional client-generated id to match optimistic UI messages
    clientId: {
      type: String,
      index: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ chatId: 1, createdAt: 1 });

messageSchema.index({ "file.expiresAt": 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Message", messageSchema);
