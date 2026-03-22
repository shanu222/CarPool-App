let io = null;

export const setIo = (socketServer) => {
  io = socketServer;
};

export const getIo = () => io;
