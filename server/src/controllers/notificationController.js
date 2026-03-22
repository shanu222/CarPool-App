import { Notification } from "../models/Notification.js";

const mapNotification = (item) => ({
  _id: item._id,
  userId: item.user,
  type: item.type,
  title: item.title,
  body: item.body,
  isRead: Boolean(item.read),
  read: Boolean(item.read),
  createdAt: item.createdAt,
  data: item.data || {},
});

export const getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ read: 1, createdAt: -1 })
      .limit(100);

    return res.json(notifications.map(mapNotification));
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

    return res.json(mapNotification(notification));
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

export const getNotificationSettings = async (req, res, next) => {
  try {
    return res.json({
      messages: req.user.notificationSettings?.messages !== false,
      rides: req.user.notificationSettings?.rides !== false,
      payments: req.user.notificationSettings?.payments !== false,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateNotificationSettings = async (req, res, next) => {
  try {
    const messages = req.body?.messages;
    const rides = req.body?.rides;
    const payments = req.body?.payments;

    req.user.notificationSettings = {
      messages: typeof messages === "boolean" ? messages : req.user.notificationSettings?.messages !== false,
      rides: typeof rides === "boolean" ? rides : req.user.notificationSettings?.rides !== false,
      payments: typeof payments === "boolean" ? payments : req.user.notificationSettings?.payments !== false,
    };

    await req.user.save();

    return res.json(req.user.notificationSettings);
  } catch (error) {
    return next(error);
  }
};
