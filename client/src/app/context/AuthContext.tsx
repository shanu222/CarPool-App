import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "../types";
import { clearSession, getStoredUser, getToken, setStoredUser, setToken } from "../lib/storage";
import { disconnectSocket } from "../lib/socket";
import { api } from "../lib/api";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (nextToken: string, nextUser: User) => void;
  setCurrentUser: (nextUser: User) => void;
  syncAccessSummary: (payload: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [tokenState, setTokenState] = useState<string | null>(getToken());

  const setAuth = (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setStoredUser(nextUser);
    setTokenState(nextToken);
    setUser(nextUser);
  };

  const setCurrentUser = (nextUser: User) => {
    setStoredUser(nextUser);
    setUser(nextUser);
  };

  const syncAccessSummary = (payload: any) => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    setUser((previousUser) => {
      if (!previousUser) {
        return previousUser;
      }

      const hasTokensLeft = Number.isFinite(Number(payload.tokensLeft));
      const hasTokensSpent = Number.isFinite(Number(payload.tokensSpent));

      if (!hasTokensLeft && !hasTokensSpent) {
        return previousUser;
      }

      const nextUser = {
        ...previousUser,
        ...(hasTokensLeft
          ? {
              tokens: Number(payload.tokensLeft),
              tokenBalance: Number(payload.tokensLeft),
            }
          : {}),
        ...(hasTokensSpent
          ? {
              tokensSpent: Number(payload.tokensSpent),
            }
          : {}),
      };

      setStoredUser(nextUser);
      return nextUser;
    });
  };

  useEffect(() => {
    if (!tokenState || !user || user.role !== "passenger") {
      return;
    }

    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await api.post("/api/user/location", {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        } catch {
          // no-op: location capture should not block login flow
        }
      },
      () => {
        // no-op when permission denied
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [tokenState, user]);

  const logout = () => {
    clearSession();
    disconnectSocket();
    setUser(null);
    setTokenState(null);
  };

  const value = useMemo(
    () => ({
      user,
      token: tokenState,
      isAuthenticated: Boolean(user && tokenState),
      setAuth,
      setCurrentUser,
      syncAccessSummary,
      logout,
    }),
    [user, tokenState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
