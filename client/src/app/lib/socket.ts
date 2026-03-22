import { io, type Socket } from "socket.io-client";
import { getToken } from "./storage";

let socket: Socket | null = null;

const normalizeBaseUrl = (value?: string) => {
  const raw = (value || "").trim();

  if (!raw) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
};

export const getSocket = () => {
  const baseUrl =
    normalizeBaseUrl(import.meta.env.VITE_API_URL) ||
    normalizeBaseUrl(import.meta.env.VITE_BACKEND_URL) ||
    normalizeBaseUrl(import.meta.env.VITE_SERVER_URL) ||
    "https://carpool-app-backend-production.up.railway.app";
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
