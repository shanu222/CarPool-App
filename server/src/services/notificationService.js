import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { sendPushNotification } from "./pushService.js";
import { getIo } from "../socket/io.js";

const typeToSetting = {
  message: "messages",
  ride_request: "rides",
  payment_update: "payments",
};

const isTypeEnabled = (user, type) => {
  const key = typeToSetting[type];
  if (!key) {
    return true;
  }

  return user?.notificationSettings?.[key] !== false;
};

export const createUserNotification = async ({ userId, type, title, body, data = {}, pushFallback = true }) => {
  const user = await User.findById(userId).select("notificationSettings fcmToken");
  if (!user || !isTypeEnabled(user, type)) {
    return null;
  }

  const notification = await Notification.create({
    user: userId,
    type,
    title,
    body,
    data,
  });

  const io = getIo();
  if (io) {
    io.to(`user:${String(userId)}`).emit("new_notification", notification);
  }

  if (pushFallback) {
    await sendPushNotification({
      token: user.fcmToken,
      title,
      body,
      data,
    });
  }

  return notification;
};
