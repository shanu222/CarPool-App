import { User } from "../models/User.js";

const ACTION_KEY_MAP = {
  post_ride: {
    freeCreditField: "freePostsRemaining",
  },
  chat: {
    freeCreditField: "freeChatsRemaining",
  },
};

const getActionConfig = (action) => ACTION_KEY_MAP[action] || null;

export const getActionTokenStatus = async ({ userId, action }) => {
  const config = getActionConfig(action);

  if (!config) {
    throw new Error(`Unsupported token action '${action}'`);
  }

  const user = await User.findById(userId).select("tokens hasPurchased freePostsRemaining freeChatsRemaining");

  if (!user) {
    return { allowed: false, source: null };
  }

  const tokenBalance = Number(user.tokens || 0);
  const freeCredits = Number(user[config.freeCreditField] || 0);
  const hasPurchased = Boolean(user.hasPurchased);

  if (freeCredits > 0) {
    return { allowed: true, source: "free" };
  }

  if (hasPurchased && tokenBalance >= 2) {
    return { allowed: true, source: "token" };
  }

  return { allowed: false, source: null };
};

export const reserveActionCredit = async ({ userId, action }) => {
  const config = getActionConfig(action);

  if (!config) {
    throw new Error(`Unsupported token action '${action}'`);
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

  const tokenReservation = await User.findOneAndUpdate(
    {
      _id: userId,
      hasPurchased: true,
      tokens: { $gte: 2 },
    },
    {
      $inc: { tokens: -2 },
    },
    {
      new: true,
    }
  ).select("_id");

  if (tokenReservation) {
    return { reserved: true, source: "token" };
  }

  return { reserved: false, source: null };
};

export const refundReservedActionCredit = async ({ userId, action, source }) => {
  const config = getActionConfig(action);

  if (!config || !source) {
    return;
  }

  if (source === "token") {
    await User.findByIdAndUpdate(userId, { $inc: { tokens: 2 } });
    return;
  }

  if (source === "free") {
    await User.findByIdAndUpdate(userId, { $inc: { [config.freeCreditField]: 1 } });
  }
};
