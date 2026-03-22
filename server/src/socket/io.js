let io = null;
const onlineUsers = new Map();

export const setIo = (socketServer) => {
  io = socketServer;
};

export const getIo = () => io;

export const setUserOnline = (userId) => {
  const key = String(userId);
  onlineUsers.set(key, (onlineUsers.get(key) || 0) + 1);
};

export const setUserOffline = (userId) => {
  const key = String(userId);
  const count = onlineUsers.get(key) || 0;

  if (count <= 1) {
    onlineUsers.delete(key);
    return;
  }

  onlineUsers.set(key, count - 1);
};

export const isUserOnline = (userId) => onlineUsers.has(String(userId));
