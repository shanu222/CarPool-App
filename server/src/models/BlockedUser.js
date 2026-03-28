import mongoose from "mongoose";

const blockedUserSchema = new mongoose.Schema(
  {
    blockerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blockedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

blockedUserSchema.index({ blockerId: 1, blockedUserId: 1 }, { unique: true });

export const BlockedUser = mongoose.model("BlockedUser", blockedUserSchema);
