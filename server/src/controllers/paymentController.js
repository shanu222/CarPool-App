import { Payment } from "../models/Payment.js";
import { PaymentSettings } from "../models/PaymentSettings.js";
import { getUserAccessSummary } from "../middleware/tokenAccessMiddleware.js";
import { getInteractionQuote, PRICING_CURRENCY } from "../services/interactionPricingService.js";

const buildFilePath = (req, file) => {
  if (!file) {
    return undefined;
  }

  return `/uploads/payments/${file.filename}`;
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
    const requestedAmount = Number(req.body?.amount || 0);
    const type = "interaction_unlock";
    const uploadedFile = req.file || req.files?.paymentProof?.[0] || req.files?.proof?.[0];
    const screenshot = buildFilePath(req, uploadedFile);
    const tokenRate = 2;
    const costPerAction = 2;

    if (!screenshot) {
      return res.status(400).json({ message: "Payment screenshot is required" });
    }

    if (!method) {
      return res.status(400).json({ message: "Payment method is required" });
    }

    if (!["easypaisa", "jazzcash", "bank"].includes(method)) {
      return res.status(400).json({ message: "Valid payment method is required" });
    }

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    if (!rideId) {
      const tokensRequested = Math.max(0, Math.floor(requestedAmount * 2));

      const payment = await Payment.create({
        userId: req.user._id,
        role: req.user.role,
        type: "token_purchase",
        amount: requestedAmount,
        tokensRequested,
        currency: PRICING_CURRENCY,
        method,
        screenshot,
        proofImage: screenshot,
        status: "pending",
      });

      return res.status(201).json({
        message: "Payment proof uploaded",
        payment,
        tokenInfo: {
          tokenRate,
          costPerAction,
        },
        ...getUserAccessSummary(req.user),
      });
    }

    if (!["driver", "passenger"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only drivers and passengers can submit interaction payment" });
    }

    const quote = await getInteractionQuote({ rideId, role: req.user.role });
    if (!quote) {
      return res.status(404).json({ message: "Ride not found" });
    }

    const interactionAmount = requestedAmount > 0 ? requestedAmount : Number(quote.amount || 0);

    const payment = await Payment.create({
      userId: req.user._id,
      role: req.user.role,
      type,
      rideId,
      distanceKm: quote.distanceKm,
      amount: interactionAmount,
      tokensRequested: Math.max(0, Math.floor(Number(interactionAmount || 0) * 2)),
      currency: quote.currency || PRICING_CURRENCY,
      method,
      screenshot,
      proofImage: screenshot,
      status: "pending",
    });

    return res.status(201).json({
      payment,
      tokenInfo: {
        tokenRate,
        costPerAction,
      },
      ...getUserAccessSummary(req.user),
    });
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
    return res.json({ payments, ...getUserAccessSummary(req.user) });
  } catch (error) {
    return next(error);
  }
};

export const getPaymentSettingsPublic = async (_req, res, next) => {
  try {
    const settings = await PaymentSettings.findOne().sort({ updatedAt: -1 });
    const defaultSettings = {
      easypaisaNumber: "03403318127",
      jazzcashNumber: "03403318127",
      bankAccount: "24897000279603",
      accountTitle: "Shahnawaz",
    };

    const payload = {
      easypaisaNumber: settings?.easypaisaNumber || defaultSettings.easypaisaNumber,
      jazzcashNumber: settings?.jazzcashNumber || defaultSettings.jazzcashNumber,
      bankAccount: settings?.bankAccount || defaultSettings.bankAccount,
      accountTitle: settings?.accountTitle || defaultSettings.accountTitle,
    };

    return res.json({
      ...payload,
      tokenRate: 2,
      actionTokenCost: 2,
    });
  } catch (error) {
    return next(error);
  }
};
