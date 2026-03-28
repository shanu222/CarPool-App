import { BlockedUser } from "../models/BlockedUser.js";
import { User } from "../models/User.js";

const normalizeIds = (values = []) => {
  return values.map((value) => String(value || "").trim()).filter(Boolean);
};

export const getBlockedPartnerIdsForUser = async (userId) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return [];
  }

  const [relations, user] = await Promise.all([
    BlockedUser.find({
      $or: [{ blockerId: normalizedUserId }, { blockedUserId: normalizedUserId }],
    }).select("blockerId blockedUserId"),
    User.findById(normalizedUserId).select("blockedUsers"),
  ]);

  const ids = new Set(normalizeIds(user?.blockedUsers || []));

  relations.forEach((item) => {
    const blockerId = String(item.blockerId || "");
    const blockedUserId = String(item.blockedUserId || "");

    if (blockerId === normalizedUserId && blockedUserId) {
      ids.add(blockedUserId);
    }

    if (blockedUserId === normalizedUserId && blockerId) {
      ids.add(blockerId);
    }
  });

  ids.delete(normalizedUserId);
  return [...ids];
};

export const areUsersBlocked = async (aUserId, bUserId) => {
  const aId = String(aUserId || "").trim();
  const bId = String(bUserId || "").trim();

  if (!aId || !bId || aId === bId) {
    return false;
  }

  const relationExists = await BlockedUser.exists({
    $or: [
      { blockerId: aId, blockedUserId: bId },
      { blockerId: bId, blockedUserId: aId },
    ],
  });

  if (relationExists) {
    return true;
  }

  const [aUser, bUser] = await Promise.all([
    User.findById(aId).select("blockedUsers"),
    User.findById(bId).select("blockedUsers"),
  ]);

  if (!aUser || !bUser) {
    return false;
  }

  const aBlocked = normalizeIds(aUser.blockedUsers || []);
  const bBlocked = normalizeIds(bUser.blockedUsers || []);

  return aBlocked.includes(bId) || bBlocked.includes(aId);
};
