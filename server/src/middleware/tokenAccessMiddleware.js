import { User } from "../models/User.js";

const ACTION_COST = 2;
const TOKEN_RATE_PER_PKR = 2;

const normalizeCount = (value) => Math.max(0, Number(value || 0));

const buildAccessSummary = (user) => ({
  tokensLeft: normalizeCount(user?.tokens),
  tokensSpent: normalizeCount(user?.tokensSpent),
  freeChatsLeft: normalizeCount(user?.freeChats ?? user?.freeChatsRemaining),
  freePostsLeft: normalizeCount(user?.freePosts ?? user?.freePostsRemaining),
  freeRequestsLeft: normalizeCount(user?.freeRequests ?? user?.freeRequestsRemaining),
});

const attachAccessSummaryOnResponse = (req, res) => {
  if (res.locals.__accessSummaryPatched) {
    return;
  }

  res.locals.__accessSummaryPatched = true;
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    if (!payload || Array.isArray(payload) || typeof payload !== "object") {
      return originalJson(payload);
    }

    return originalJson({ ...payload, ...buildAccessSummary(req.user) });
  };
};

const spendAccessCredit = async ({ userId, freeField }) => {
  const tokenUpdate = await User.findOneAndUpdate(
    {
      _id: userId,
      tokens: { $gte: ACTION_COST },
    },
    {
      $inc: { tokens: -ACTION_COST, tokenBalance: -ACTION_COST, tokensSpent: ACTION_COST },
    },
    { new: true }
  );

  if (tokenUpdate) {
    return { ok: true, user: tokenUpdate };
  }

  const latestUser = await User.findById(userId);
  return { ok: false, user: latestUser };
};

const createAccessMiddleware = (freeField) => async (req, res, next) => {
  try {
    if (req.user?.role === "admin") {
      attachAccessSummaryOnResponse(req, res);
      return next();
    }

    const spent = await spendAccessCredit({ userId: req.user._id, freeField });

    if (!spent.ok) {
      req.user = spent.user;

      if (normalizeCount(spent.user?.tokens) > 0 && normalizeCount(spent.user?.tokens) < ACTION_COST) {
        return res.status(403).json({
          message: "Insufficient tokens. Please recharge.",
          requiresPayment: true,
          redirectTo: "/payment-methods",
          tokenInfo: {
            tokenRate: TOKEN_RATE_PER_PKR,
            costPerAction: ACTION_COST,
          },
          ...buildAccessSummary(spent.user),
        });
      }

      return res.status(403).json({
        message: "Insufficient tokens. Please recharge.",
        requiresPayment: true,
        redirectTo: "/payment-methods",
        tokenInfo: {
          tokenRate: TOKEN_RATE_PER_PKR,
          costPerAction: ACTION_COST,
        },
        ...buildAccessSummary(spent.user),
      });
    }

    req.user = spent.user;
    attachAccessSummaryOnResponse(req, res);
    return next();
  } catch (error) {
    return next(error);
  }
};

export const checkChatAccess = createAccessMiddleware("freeChats");
export const checkPostAccess = createAccessMiddleware("freePosts");
export const checkRequestAccess = createAccessMiddleware("freeRequests");

export const requireDriverForPost = (req, res, next) => {
  if (!req.user || req.user.role !== "driver") {
    return res.status(403).json({ message: "Only drivers can post rides" });
  }

  return next();
};

export const requirePassengerForRequest = (req, res, next) => {
  if (!req.user || req.user.role !== "passenger") {
    return res.status(403).json({ message: "Only passengers can request rides" });
  }

  return next();
};

export const getUserAccessSummary = buildAccessSummary;
