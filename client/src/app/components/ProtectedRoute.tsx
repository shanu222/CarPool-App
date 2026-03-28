import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";
import { api } from "../lib/api";
import { TokenIndicator } from "./TokenIndicator";

export function ProtectedRoute() {
  const { isAuthenticated, user, setCurrentUser } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const refreshCurrentUser = async () => {
      if (!user?._id && !user?.id) {
        return;
      }

      try {
        const userId = user._id || user.id;
        const response = await api.get(`/api/users/${userId}`);
        if (response?.data) {
          setCurrentUser({ ...user, ...response.data });
        }
      } catch {
        // Keep existing session user if refresh fails.
      }
    };

    if (isAuthenticated) {
      refreshCurrentUser();
    }
  }, [isAuthenticated, user?._id, user?.id, setCurrentUser]);

  useEffect(() => {
    if (!isAuthenticated || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        api.post('/api/user/location', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }).catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return (
    <>
      <div className="pointer-events-none fixed left-3 top-3 z-40 md:left-4 md:top-4">
        <TokenIndicator user={user} />
      </div>
      <Outlet />
    </>
  );
}
