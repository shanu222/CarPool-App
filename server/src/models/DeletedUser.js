import mongoose from "mongoose";

const deletedUserSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
      required: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },
    cnic: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },
    deletedBy: {
      type: String,
      enum: ["user", "admin"],
      required: true,
      index: true,
    },
    deleteReason: {
      type: String,
      trim: true,
      required: true,
    },
    deletedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

deletedUserSchema.index({ mobileNumber: 1, deletedAt: -1 });
deletedUserSchema.index({ cnic: 1, deletedAt: -1 });

export const DeletedUser = mongoose.model("DeletedUser", deletedUserSchema);
