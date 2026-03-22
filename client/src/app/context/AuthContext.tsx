import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "../types";
import { clearSession, getStoredUser, getToken, setStoredUser, setToken } from "../lib/storage";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (nextToken: string, nextUser: User) => void;
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

  const logout = () => {
    clearSession();
    setUser(null);
    setTokenState(null);
  };

  const value = useMemo(
    () => ({
      user,
      token: tokenState,
      isAuthenticated: Boolean(user && tokenState),
      setAuth,
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
