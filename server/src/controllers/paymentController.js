import { Payment } from "../models/Payment.js";
import { PaymentSettings } from "../models/PaymentSettings.js";

const buildFilePath = (req, file) => {
  if (!file) {
    return undefined;
  }

  return `${req.protocol}://${req.get("host")}/uploads/payments/${file.filename}`;
};

const getDefaultAmount = (type) => {
  if (type === "ride_post") {
    return 200;
  }

  if (type === "booking_unlock") {
    return 100;
  }

  return 0;
};

export const submitPaymentProof = async (req, res, next) => {
  try {
    const { type, method, amount } = req.body;

    if (!type || !method || !["ride_post", "booking_unlock"].includes(type)) {
      return res.status(400).json({ message: "Valid payment type and method are required" });
    }

    if (!["easypaisa", "jazzcash", "bank"].includes(method)) {
      return res.status(400).json({ message: "Valid payment method is required" });
    }

    const screenshot = buildFilePath(req, req.file);
    if (!screenshot) {
      return res.status(400).json({ message: "Payment screenshot is required" });
    }

    if (type === "ride_post" && req.user.role !== "driver") {
      return res.status(403).json({ message: "ride_post payment is only for driver accounts" });
    }

    if (type === "booking_unlock" && req.user.role !== "passenger") {
      return res.status(403).json({ message: "booking_unlock payment is only for passenger accounts" });
    }

    const payment = await Payment.create({
      userId: req.user._id,
      role: req.user.role,
      type,
      amount: Number(amount || getDefaultAmount(type)),
      method,
      screenshot,
      status: "pending",
    });

    return res.status(201).json(payment);
  } catch (error) {
    return next(error);
  }
};

export const getMyPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.json(payments);
  } catch (error) {
    return next(error);
  }
};

export const getPaymentSettingsPublic = async (_req, res, next) => {
  try {
    const settings = await PaymentSettings.findOne().sort({ updatedAt: -1 });

    return res.json(
      settings || {
        easypaisaNumber: "",
        jazzcashNumber: "",
        bankAccount: "",
        accountTitle: "",
      }
    );
  } catch (error) {
    return next(error);
  }
};
