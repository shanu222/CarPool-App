import { io, type Socket } from "socket.io-client";
import { getToken } from "./storage";

let socket: Socket | null = null;

export const getSocket = () => {
  const baseUrl = import.meta.env.VITE_API_URL || "https://carpool-app-backend-production.up.railway.app";
  const token = getToken();

  if (!token) {
    return null;
  }

  if (!socket) {
    socket = io(baseUrl, {
      transports: ["websocket"],
      auth: { token },
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
