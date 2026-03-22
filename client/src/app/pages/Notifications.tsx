import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { Button } from "../components/Button";
import type { NotificationItem, NotificationSettings } from "../types";

const formatTime = (value: string) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    messages: true,
    rides: true,
    payments: true,
  });
  const [loading, setLoading] = useState(true);

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead && !item.read).length, [items]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [notificationsResponse, settingsResponse] = await Promise.all([
        api.get<NotificationItem[]>("/api/notifications/my"),
        api.get<NotificationSettings>("/api/notifications/settings"),
      ]);

      setItems(notificationsResponse.data || []);
      setSettings(settingsResponse.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      return;
    }

    const onNewNotification = (payload: any) => {
      const incoming: NotificationItem = {
        _id: payload._id,
        userId: payload.userId || payload.user,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        isRead: Boolean(payload.isRead ?? payload.read),
        read: Boolean(payload.read ?? payload.isRead),
        createdAt: payload.createdAt || new Date().toISOString(),
        data: payload.data || {},
      };

      setItems((prev) => [incoming, ...prev]);
    };

    socket.on("new_notification", onNewNotification);

    return () => {
      socket.off("new_notification", onNewNotification);
    };
  }, []);

  const markRead = async (item: NotificationItem) => {
    if (item.isRead || item.read) {
      return;
    }

    try {
      await api.patch(`/api/notifications/${item._id}/read`);
      setItems((prev) =>
        prev.map((current) =>
          current._id === item._id
            ? {
                ...current,
                isRead: true,
                read: true,
              }
            : current
        )
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not mark read");
    }
  };

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    const next = {
      ...settings,
      [key]: value,
    };

    setSettings(next);

    try {
      await api.patch("/api/notifications/settings", next);
      toast.success("Notification settings updated");
    } catch (error: any) {
      setSettings(settings);
      toast.error(error?.response?.data?.message || "Could not update settings");
    }
  };

  return (
    <div className="min-h-screen bg-transparent px-3 py-3 pb-24 md:px-4 md:py-4">
      <div className="glass-panel rounded-3xl p-4 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <Button
            onClick={() => navigate(-1)}
            variant="secondary"
            fullWidth={false}
            className="!w-auto !bg-white/85 text-slate-900"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Back
          </Button>
          <p className="text-sm text-slate-100">Unread: {unreadCount}</p>
        </div>

        <h1 className="mt-3 text-lg md:text-2xl text-white">Notifications</h1>

        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
          <SettingToggle label="Messages" checked={settings.messages} onChange={(value) => updateSetting("messages", value)} />
          <SettingToggle label="Ride Requests" checked={settings.rides} onChange={(value) => updateSetting("rides", value)} />
          <SettingToggle label="Payment Updates" checked={settings.payments} onChange={(value) => updateSetting("payments", value)} />
        </div>
      </div>

      {loading ? <p className="mt-4 text-sm text-slate-100">Loading notifications...</p> : null}

      <div className="mt-4 space-y-3">
        {items.map((item, index) => {
          const isRead = item.isRead || item.read;

          return (
            <motion.button
              key={item._id}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.2) }}
              onClick={() => markRead(item)}
              className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 ${
                isRead
                  ? "border-white/20 bg-white/10"
                  : "border-cyan-300/70 bg-cyan-900/25 shadow-lg shadow-cyan-900/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm md:text-base text-white">{item.title}</p>
                  <p className="mt-1 text-xs md:text-sm text-slate-100">{item.body}</p>
                </div>
                {!isRead ? <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-[10px] text-slate-900">New</span> : null}
              </div>
              <p className="mt-2 text-[11px] text-slate-300">{formatTime(item.createdAt)}</p>
            </motion.button>
          );
        })}

        {!loading && items.length === 0 ? (
          <div className="glass-panel rounded-2xl p-6 text-sm text-slate-100">No notifications yet.</div>
        ) : null}
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/25 bg-white/10 px-3 py-3">
      <span className="text-xs md:text-sm text-white">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-all duration-200 ${checked ? "bg-cyan-400" : "bg-slate-400/60"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-200 ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </label>
  );
}
