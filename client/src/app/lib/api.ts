import axios from "axios";
import { clearSession, getToken } from "./storage";

const normalizeBaseUrl = (value?: string) => {
  const raw = (value || "").trim();

  if (!raw) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
};

const baseURL =
  normalizeBaseUrl(import.meta.env.VITE_API_URL) ||
  normalizeBaseUrl(import.meta.env.VITE_BACKEND_URL) ||
  normalizeBaseUrl(import.meta.env.VITE_SERVER_URL) ||
  "https://carpool-app-backend-production.up.railway.app";

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearSession();
    }

    return Promise.reject(error);
  }
);
