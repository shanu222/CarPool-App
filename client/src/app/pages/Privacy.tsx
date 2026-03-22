import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/Button";
import type { BlockedUser } from "../types";

export function Privacy() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(true);

  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const loadBlockedUsers = async () => {
    try {
      setLoadingBlocked(true);
      const response = await api.get<BlockedUser[]>("/api/user/blocked");
      setBlockedUsers(response.data || []);
    } catch {
      setBlockedUsers([]);
    } finally {
      setLoadingBlocked(false);
    }
  };

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const changePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim()) {
      toast.error("Both password fields are required");
      return;
    }

    try {
      setChangingPassword(true);
      await api.post("/api/auth/change-password", {
        oldPassword: oldPassword.trim(),
        newPassword: newPassword.trim(),
      });
      setOldPassword("");
      setNewPassword("");
      toast.success("Password changed");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const unblockUser = async (id: string) => {
    try {
      await api.delete(`/api/user/block/${id}`);
      setBlockedUsers((prev) => prev.filter((item) => item._id !== id));
      toast.success("User unblocked");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not unblock user");
    }
  };

  const logoutAllDevices = async () => {
    try {
      setLoggingOutAll(true);
      await api.post("/api/auth/logout-all");
      logout();
      navigate("/auth", { replace: true });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not logout all devices");
    } finally {
      setLoggingOutAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent px-3 py-3 pb-24 md:px-4 md:py-4">
      <div className="glass-panel rounded-3xl p-4 md:p-5">
        <Button
          onClick={() => navigate(-1)}
          variant="secondary"
          fullWidth={false}
          className="!w-auto !bg-white/85 text-slate-900"
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Back
        </Button>

        <h1 className="mt-3 text-lg md:text-2xl text-white">Privacy & Security</h1>

        <div className="mt-4 space-y-3">
          <section className="rounded-2xl border border-white/25 bg-white/10 p-4 space-y-2">
            <p className="text-sm text-white">Change Password</p>
            <input
              type="password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
              placeholder="Old password"
              className="w-full rounded-xl border border-white/30 bg-white/20 px-3 py-3 text-sm text-white"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              className="w-full rounded-xl border border-white/30 bg-white/20 px-3 py-3 text-sm text-white"
            />
            <Button onClick={changePassword} loading={changingPassword} loadingText="Processing..." variant="primary">
              Update Password
            </Button>
          </section>

          <section className="rounded-2xl border border-white/25 bg-white/10 p-4 space-y-2">
            <p className="text-sm text-white">Blocked Users</p>
            {loadingBlocked ? <p className="text-xs text-slate-100">Loading blocked users...</p> : null}
            {!loadingBlocked && blockedUsers.length === 0 ? <p className="text-xs text-slate-200">No blocked users.</p> : null}
            {blockedUsers.map((user) => (
              <div key={user._id} className="flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-2">
                <div>
                  <p className="text-sm text-white">{user.name}</p>
                  <p className="text-xs text-slate-200">{user.role}</p>
                </div>
                <Button
                  onClick={() => unblockUser(user._id)}
                  variant="secondary"
                  fullWidth={false}
                  className="!w-auto !bg-white/85 px-3 text-slate-900"
                >
                  Unblock
                </Button>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-white/25 bg-white/10 p-4">
            <Button onClick={logoutAllDevices} loading={loggingOutAll} loadingText="Processing..." variant="danger">
              Logout From All Devices
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
