import { Notification } from "../models/Notification.js";

export const getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json(notifications);
  } catch (error) {
    return next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.json(notification);
  } catch (error) {
    return next(error);
  }
};

export const registerFcmToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken?.trim()) {
      return res.status(400).json({ message: "fcmToken is required" });
    }

    req.user.fcmToken = fcmToken.trim();
    await req.user.save();

    return res.json({ message: "FCM token saved" });
  } catch (error) {
    return next(error);
  }
};
