import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isSeen: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

messageSchema.virtual("ride").get(function getRide() {
  return this.rideId;
});

messageSchema.virtual("sender").get(function getSender() {
  return this.senderId;
});

messageSchema.virtual("receiver").get(function getReceiver() {
  return this.receiverId;
});

messageSchema.virtual("text").get(function getText() {
  return this.message;
});

messageSchema.index({ rideId: 1, timestamp: 1 });

export const Message = mongoose.model("Message", messageSchema);
