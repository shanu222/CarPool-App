import mongoose from "mongoose";

const paymentSettingsSchema = new mongoose.Schema(
  {
    easypaisaNumber: {
      type: String,
      trim: true,
      default: "03403318127",
    },
    jazzcashNumber: {
      type: String,
      trim: true,
      default: "03403318127",
    },
    bankAccount: {
      type: String,
      trim: true,
      default: "24897000279603",
    },
    accountTitle: {
      type: String,
      trim: true,
      default: "Shahnawaz",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const PaymentSettings = mongoose.model("PaymentSettings", paymentSettingsSchema);
