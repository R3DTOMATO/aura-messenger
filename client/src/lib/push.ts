// Browser push notification helpers.
import { trpc } from "@/lib/trpc";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushPermissionState(): Promise<NotificationPermission | "unsupported"> {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    console.warn("[Push] SW registration failed", e);
    return null;
  }
}

export async function subscribeToPush(
  vapidPublicKey: string,
  saveSubscription: (sub: PushSubscription) => Promise<void>
): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "지원되지 않는 브라우저입니다" };
  if (!vapidPublicKey) {
    return { ok: false, reason: "서버에 푸시 키가 설정되지 않았습니다" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "알림 권한이 거부되었습니다" };
  }

  const reg = await ensureServiceWorker();
  if (!reg) return { ok: false, reason: "서비스 워커 등록 실패" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
    } catch (e) {
      console.warn("[Push] subscribe failed", e);
      return { ok: false, reason: "구독 실패" };
    }
  }

  await saveSubscription(sub);
  return { ok: true };
}

export async function unsubscribeFromPush(
  removeSubscription: (endpoint: string) => Promise<void>
): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return false;
  await removeSubscription(sub.endpoint);
  await sub.unsubscribe();
  return true;
}

export function usePushNotifications() {
  const utils = trpc.useUtils();
  const keyQuery = trpc.push.publicKey.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const subscribeMut = trpc.push.subscribe.useMutation();
  const unsubscribeMut = trpc.push.unsubscribe.useMutation();

  const enable = async () => {
    const publicKey = keyQuery.data?.publicKey ?? "";
    return subscribeToPush(publicKey, async (sub) => {
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Subscription incomplete");
      }
      await subscribeMut.mutateAsync({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      });
    });
  };

  const disable = async () => {
    return unsubscribeFromPush(async (endpoint) => {
      await unsubscribeMut.mutateAsync({ endpoint });
    });
  };

  return {
    isSupported: isPushSupported(),
    publicKey: keyQuery.data?.publicKey ?? "",
    enable,
    disable,
    isLoading: subscribeMut.isPending || unsubscribeMut.isPending,
  };
}
