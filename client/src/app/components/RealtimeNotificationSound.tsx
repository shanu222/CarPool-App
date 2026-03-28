import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../lib/socket";

const SOUND_SRC = "/sounds/notification.mp3";

const getCurrentUserId = (user: { id?: string; _id?: string } | null | undefined) => String(user?.id || user?._id || "");

const playFallbackTone = () => {
  if (typeof window === "undefined") {
    return;
  }

  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  const context = new AudioCtx();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "square";
  oscillator.frequency.value = 940;
  gain.gain.value = 0.18;

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  setTimeout(() => {
    oscillator.stop();
    context.close();
  }, 180);
};

const maybeShowMobileLocalNotification = async (title: string, body: string) => {
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    return;
  }

  const capacitor = (window as any)?.Capacitor;
  const localNotifications = capacitor?.Plugins?.LocalNotifications;

  if (!localNotifications?.schedule) {
    return;
  }

  try {
    await localNotifications.requestPermissions?.();
    await localNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2147483646),
          title,
          body,
          sound: "notification.mp3",
        },
      ],
    });
  } catch {
    // no-op: notifications are optional fallback on mobile
  }
};

export function RealtimeNotificationSound() {
  const { user } = useAuth();
  const userId = useMemo(() => getCurrentUserId(user), [user]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const audio = new Audio(SOUND_SRC);
    audio.preload = "auto";
    audio.volume = 1;
    audioRef.current = audio;

    const unlockAudio = async () => {
      try {
        audio.muted = true;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      } catch {
        // Browser may still block autoplay; event-time playback has fallback.
      }
    };

    const onFirstGesture = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
      window.removeEventListener("touchstart", onFirstGesture);
    };

    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    window.addEventListener("keydown", onFirstGesture, { once: true });
    window.addEventListener("touchstart", onFirstGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
      window.removeEventListener("touchstart", onFirstGesture);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const socket = getSocket();
    if (!socket) {
      return;
    }

    const playNotificationSound = async (title?: string, body?: string) => {
      try {
        const audio = audioRef.current;
        if (!audio) {
          playFallbackTone();
        } else {
          audio.currentTime = 0;
          await audio.play();
        }
      } catch {
        playFallbackTone();
      }

      if (title && body) {
        await maybeShowMobileLocalNotification(title, body);
      }
    };

    const onNewMessage = async (payload: any) => {
      const senderId = String(payload?.sender?._id || payload?.senderId?._id || payload?.senderId || "");
      if (senderId && senderId === userId) {
        return;
      }

      toast.info("New chat message received");
      await playNotificationSound("New message", "You received a new chat message");
    };

    const onRideMatched = async () => {
      toast.success("Ride match found");
      await playNotificationSound("Ride matched", "A new ride match needs your attention");
    };

    const onRideAccepted = async () => {
      toast.success("Ride accepted");
      await playNotificationSound("Ride accepted", "Your ride request has been accepted");
    };

    const onImportantSystemNotification = async (payload: any) => {
      const type = String(payload?.type || "").toLowerCase();
      if (!["payment_update", "ride_request", "generic"].includes(type)) {
        return;
      }

      await playNotificationSound(payload?.title || "Update", payload?.body || "Important account update");
    };

    socket.on("new_message", onNewMessage);
    socket.on("ride_matched", onRideMatched);
    socket.on("ride_accepted", onRideAccepted);
    socket.on("new_notification", onImportantSystemNotification);

    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("ride_matched", onRideMatched);
      socket.off("ride_accepted", onRideAccepted);
      socket.off("new_notification", onImportantSystemNotification);
    };
  }, [userId]);

  return null;
}
