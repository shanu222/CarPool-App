import type { SyntheticEvent } from "react";
import { api } from "./api";

export const DEFAULT_AVATAR_SRC = "/default-avatar.svg";

export const toAvatarUrl = (value?: string | null) => {
  const raw = String(value || "").trim();

  if (!raw) {
    return DEFAULT_AVATAR_SRC;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const base = String(api.defaults.baseURL || "").replace(/\/$/, "");
  const normalizedPath = raw.startsWith("/") ? raw : `/${raw}`;

  return base ? `${base}${normalizedPath}` : normalizedPath;
};

export const handleAvatarError = (event: SyntheticEvent<HTMLImageElement>) => {
  const target = event.currentTarget;

  if (target.dataset.fallbackApplied === "true") {
    return;
  }

  target.dataset.fallbackApplied = "true";
  target.src = DEFAULT_AVATAR_SRC;
};
