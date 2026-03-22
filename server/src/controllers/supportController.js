import { SupportRequest } from "../models/SupportRequest.js";

export const createSupportRequest = async (req, res, next) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({ message: "message is required" });
    }

    const supportRequest = await SupportRequest.create({
      userId: req.user._id,
      message,
      status: "open",
    });

    return res.status(201).json(supportRequest);
  } catch (error) {
    return next(error);
  }
};
