import { Payment } from "../models/Payment.js";
import { PaymentSettings } from "../models/PaymentSettings.js";
import { getInteractionQuote, PRICING_CURRENCY } from "../services/interactionPricingService.js";

const buildFilePath = (req, file) => {
  if (!file) {
    return undefined;
  }

  return `${req.protocol}://${req.get("host")}/uploads/payments/${file.filename}`;
};

export const getPaymentQuote = async (req, res, next) => {
  try {
    const { rideId } = req.params;

    if (!rideId) {
      return res.status(400).json({ message: "rideId is required" });
    }

    if (!req.user || !["driver", "passenger"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only drivers and passengers can request interaction quote" });
    }

    const quote = await getInteractionQuote({ rideId, role: req.user.role });
    if (!quote) {
      return res.status(404).json({ message: "Ride not found" });
    }

    return res.json({
      rideId: quote.ride._id,
      distanceKm: quote.distanceKm,
      amount: quote.amount,
      currency: quote.currency,
      role: req.user.role,
    });
  } catch (error) {
    return next(error);
  }
};

export const submitPaymentProof = async (req, res, next) => {
  try {
    const { method, rideId } = req.body;
    const type = "interaction_unlock";

    if (!rideId) {
      return res.status(400).json({ message: "rideId is required" });
    }

    if (!method) {
      return res.status(400).json({ message: "Payment method is required" });
    }

    if (!["easypaisa", "jazzcash", "bank"].includes(method)) {
      return res.status(400).json({ message: "Valid payment method is required" });
    }

    const screenshot = buildFilePath(req, req.file);
    if (!screenshot) {
      return res.status(400).json({ message: "Payment screenshot is required" });
    }

    if (!["driver", "passenger"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only drivers and passengers can submit interaction payment" });
    }

    const quote = await getInteractionQuote({ rideId, role: req.user.role });
    if (!quote) {
      return res.status(404).json({ message: "Ride not found" });
    }

    const existing = await Payment.findOne({
      userId: req.user._id,
      rideId,
      type,
      status: { $in: ["pending", "approved"] },
    }).sort({ createdAt: -1 });

    if (existing) {
      return res.status(409).json({ message: existing.status === "approved" ? "Interaction already unlocked for this ride" : "Payment review already pending for this ride" });
    }

    const payment = await Payment.create({
      userId: req.user._id,
      role: req.user.role,
      type,
      rideId,
      distanceKm: quote.distanceKm,
      amount: quote.amount,
      currency: quote.currency || PRICING_CURRENCY,
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
    const { rideId } = req.query;
    const query = {
      userId: req.user._id,
      ...(rideId ? { rideId } : {}),
    };

    const payments = await Payment.find(query).sort({ createdAt: -1 });
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
