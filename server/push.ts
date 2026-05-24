// Web Push notifications using VAPID.
// Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)
// in environment variables. Generate keys with:
//   npx web-push generate-vapid-keys
import webpush from "web-push";
import { deletePushSubscription, getUserPushSubscriptions } from "./db";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    // Don't throw — push is optional. Just log once.
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[Push] VAPID keys not configured. Push notifications disabled. " +
          "Run `npx web-push generate-vapid-keys` and set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY."
      );
    }
    return;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || "";
}

export function isPushConfigured(): boolean {
  ensureConfigured();
  return configured;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
};

export async function sendPushToUser(userId: number, payload: PushPayload) {
  ensureConfigured();
  if (!configured) return;

  const subs = await getUserPushSubscriptions(userId);
  if (subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 } // 24h
        );
      } catch (e: unknown) {
        const status =
          e && typeof e === "object" && "statusCode" in e
            ? (e as { statusCode: number }).statusCode
            : undefined;
        // 404/410 = subscription expired or revoked. Remove it.
        if (status === 404 || status === 410) {
          await deletePushSubscription(userId, sub.endpoint).catch(() => {});
        } else {
          console.warn("[Push] send failed:", String(e));
        }
      }
    })
  );
}

export async function sendPushToUsers(userIds: number[], payload: PushPayload) {
  await Promise.all(userIds.map((uid) => sendPushToUser(uid, payload)));
}
