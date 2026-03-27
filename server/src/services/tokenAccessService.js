import { User } from "../models/User.js";

const ACTION_KEY_MAP = {
  post_ride: {
    freeCreditField: "freeRideCredits",
  },
  chat: {
    freeCreditField: "freeChatCredits",
  },
};

const getActionConfig = (action) => ACTION_KEY_MAP[action] || null;

export const getActionTokenStatus = async ({ userId, action }) => {
  const config = getActionConfig(action);

  if (!config) {
    throw new Error(`Unsupported token action '${action}'`);
  }

  const user = await User.findById(userId).select("tokenBalance freeRideCredits freeChatCredits");

  if (!user) {
    return { allowed: false, source: null };
  }

  const tokenBalance = Number(user.tokenBalance || 0);
  const freeCredits = Number(user[config.freeCreditField] || 0);

  if (tokenBalance > 0) {
    return { allowed: true, source: "token" };
  }

  if (freeCredits > 0) {
    return { allowed: true, source: "free" };
  }

  return { allowed: false, source: null };
};

export const reserveActionCredit = async ({ userId, action }) => {
  const config = getActionConfig(action);

  if (!config) {
    throw new Error(`Unsupported token action '${action}'`);
  }

  const tokenReservation = await User.findOneAndUpdate(
    {
      _id: userId,
      tokenBalance: { $gt: 0 },
    },
    {
      $inc: { tokenBalance: -1 },
    },
    {
      new: true,
    }
  ).select("_id");

  if (tokenReservation) {
    return { reserved: true, source: "token" };
  }

  const freeReservation = await User.findOneAndUpdate(
    {
      _id: userId,
      [config.freeCreditField]: { $gt: 0 },
    },
    {
      $inc: { [config.freeCreditField]: -1 },
    },
    {
      new: true,
    }
  ).select("_id");

  if (freeReservation) {
    return { reserved: true, source: "free" };
  }

  return { reserved: false, source: null };
};

export const refundReservedActionCredit = async ({ userId, action, source }) => {
  const config = getActionConfig(action);

  if (!config || !source) {
    return;
  }

  if (source === "token") {
    await User.findByIdAndUpdate(userId, { $inc: { tokenBalance: 1 } });
    return;
  }

  if (source === "free") {
    await User.findByIdAndUpdate(userId, { $inc: { [config.freeCreditField]: 1 } });
  }
};
