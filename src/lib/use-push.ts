import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
  sendTestPush,
} from "@/lib/push.functions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToBase64Url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type PushStatus = "unsupported" | "denied" | "granted-off" | "granted-on" | "default" | "loading";

export function usePush() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const getVapid = useServerFn(getVapidPublicKey);
  const saveSub = useServerFn(savePushSubscription);
  const delSub = useServerFn(deletePushSubscription);
  const test = useServerFn(sendTestPush);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    if (Notification.permission === "default") {
      setStatus("default");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setStatus(sub ? "granted-on" : "granted-off");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      await refresh();
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const { publicKey } = await getVapid();
    if (!publicKey) throw new Error("Push not configured on the server");
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const json = sub.toJSON();
    await saveSub({
      data: {
        endpoint: sub.endpoint,
        p256dh: (json.keys?.p256dh as string) ?? bufToBase64Url(sub.getKey("p256dh")),
        auth: (json.keys?.auth as string) ?? bufToBase64Url(sub.getKey("auth")),
        userAgent: navigator.userAgent.slice(0, 500),
      },
    });
    await refresh();
  }, [getVapid, saveSub, refresh]);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await delSub({ data: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
    await refresh();
  }, [delSub, refresh]);

  const sendTest = useCallback(async () => test(), [test]);

  return { status, enable, disable, sendTest, refresh };
}
