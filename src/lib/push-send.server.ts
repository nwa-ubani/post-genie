// Server-only web push sender. Imported dynamically from server-fn handlers.
import { buildPushPayload } from "@block65/webcrypto-web-push";

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  icon?: string;
};

type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function getVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const jwkRaw = process.env.VAPID_PRIVATE_JWK;
  const subject = process.env.VAPID_SUBJECT || "mailto:noreply@autopost.grownownow.com";
  if (!publicKey || !jwkRaw) {
    throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_JWK not configured");
  }
  const jwk = JSON.parse(jwkRaw) as { d?: string };
  if (!jwk.d) throw new Error("VAPID_PRIVATE_JWK missing `d`");
  return { subject, publicKey, privateKey: jwk.d };
}

/** Send a push to one endpoint. Returns the status; caller decides whether to delete. */
export async function sendPushToSubscription(
  sub: StoredSubscription,
  payload: PushPayload,
): Promise<{ status: number; shouldDelete: boolean }> {
  const vapid = getVapid();
  const built = await buildPushPayload(
    {
      data: payload as unknown as Parameters<typeof buildPushPayload>[0]["data"],
      options: { ttl: 60 * 60 * 24, urgency: "normal" },
    },
    { endpoint: sub.endpoint, expirationTime: null, keys: { auth: sub.auth, p256dh: sub.p256dh } },
    vapid,
  );
  const res = await fetch(sub.endpoint, {
    method: built.method,
    headers: built.headers as unknown as HeadersInit,
    body: new Uint8Array(built.body) as unknown as BodyInit,
  });
  // 404/410 = endpoint gone; caller should delete the row.
  return { status: res.status, shouldDelete: res.status === 404 || res.status === 410 };
}

/** Fan out a push to all of a user's subscriptions. Prunes dead endpoints. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) throw error;
  if (!subs || subs.length === 0) return { sent: 0, pruned: 0 };

  let sent = 0;
  const toDelete: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        const r = await sendPushToSubscription(s as StoredSubscription, payload);
        if (r.shouldDelete) toDelete.push(s.id);
        else if (r.status >= 200 && r.status < 300) sent += 1;
      } catch (err) {
        console.error("push send failed", err);
      }
    }),
  );
  if (toDelete.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", toDelete);
  }
  // touch last_used_at
  if (sent > 0) {
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId);
  }
  return { sent, pruned: toDelete.length };
}
