import mongoose from "mongoose";

const paymentSettingsSchema = new mongoose.Schema(
  {
    easypaisaNumber: {
      type: String,
      trim: true,
      default: "",
    },
    jazzcashNumber: {
      type: String,
      trim: true,
      default: "",
    },
    bankAccount: {
      type: String,
      trim: true,
      default: "",
    },
    accountTitle: {
      type: String,
      trim: true,
      default: "",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const PaymentSettings = mongoose.model("PaymentSettings", paymentSettingsSchema);
