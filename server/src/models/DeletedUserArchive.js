import mongoose from "mongoose";

const deletedUserArchiveSchema = new mongoose.Schema(
  {
    originalUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    cnic: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["passenger", "driver", "admin"],
      required: true,
    },
    banReason: {
      type: String,
      trim: true,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

deletedUserArchiveSchema.index({ role: 1, createdAt: -1 });

export const DeletedUserArchive = mongoose.model("DeletedUserArchive", deletedUserArchiveSchema);
