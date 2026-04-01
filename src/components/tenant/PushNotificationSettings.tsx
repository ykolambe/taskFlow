"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
  return out;
}

export default function PushNotificationSettings({ slug }: { slug: string }) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sw = "serviceWorker" in navigator;
    const push = "PushManager" in window;
    const notif = "Notification" in window;
    setSupported(sw && push && notif);
    if (notif) setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!supported || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(!!sub);
      } catch {
        if (!cancelled) setSubscribed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = async () => {
    setLoading(true);
    setConfigError(false);
    try {
      const keyRes = await fetch(`/api/t/${slug}/push/vapid-key`);
      const keyData = await keyRes.json();
      if (!keyRes.ok || !keyData.publicKey) {
        setConfigError(true);
        toast.error(keyData.error || "Push is not configured on the server");
        return;
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Notification permission denied");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) as BufferSource,
      });

      const res = await fetch(`/api/t/${slug}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save subscription");
        return;
      }
      setSubscribed(true);
      toast.success("Notifications enabled for this device");
    } catch (e) {
      console.error(e);
      toast.error("Could not enable notifications");
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/t/${slug}/push/subscribe`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notifications disabled on this device");
    } catch (e) {
      console.error(e);
      toast.error("Could not disable notifications");
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <div className="rounded-xl border border-surface-600/80 bg-surface-750/40 px-4 py-3 text-xs text-surface-500">
        Browser push is not available in this environment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2">
          <Bell className={cn("w-4 h-4 mt-0.5", subscribed ? "text-primary-400" : "text-surface-500")} />
          <div>
            <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Push notifications</p>
            <p className="text-[11px] text-surface-500 mt-0.5">
              Get notified when someone assigns you a task (this device). iOS: add TaskFlow to the Home Screen first.
            </p>
            {configError && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                Server missing VAPID keys — ask your administrator to set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {subscribed ? (
            <Button type="button" size="sm" variant="secondary" loading={loading} onClick={disable}>
              <BellOff className="w-3.5 h-3.5 mr-1" /> Turn off
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              loading={loading}
              onClick={enable}
              disabled={permission === "denied"}
            >
              <Bell className="w-3.5 h-3.5 mr-1" /> Enable
            </Button>
          )}
        </div>
      </div>
      {permission === "denied" && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          Notifications are blocked for this site. Enable them in your browser settings to use push.
        </p>
      )}
    </div>
  );
}
