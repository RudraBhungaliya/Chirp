import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    // Map of userId string -> unread message count for low latency badge rendering
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Multikey and compound indexes for fast inbox sorting & conversation lookups
chatSchema.index({ participants: 1, updatedAt: -1 });
chatSchema.index({ updatedAt: -1 });

export default mongoose.model("Chat", chatSchema);
