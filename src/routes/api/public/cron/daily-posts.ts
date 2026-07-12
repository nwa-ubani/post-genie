import { createFileRoute } from "@tanstack/react-router";
import { runDailyForUser } from "@/lib/posts.functions";

export const Route = createFileRoute("/api/public/cron/daily-posts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret");
        if (!secret || secret !== process.env.CRON_SECRET) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = new Date();

        // Convert UTC now to a user's local time and return minutes since midnight.
        // Uses Intl.DateTimeFormat so any valid IANA timezone string works.
        const getLocalMinutes = (timezone: string): number => {
          try {
            const parts = new Intl.DateTimeFormat("en-US", {
              timeZone: timezone,
              hour: "numeric",
              minute: "numeric",
              hour12: false,
            }).formatToParts(now);
            const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
            const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
            return h * 60 + m;
          } catch {
            // Invalid timezone — fall back to UTC so the user still gets their post
            return now.getUTCHours() * 60 + now.getUTCMinutes();
          }
        };

        // Window is 60 min because Make.com runs the scenario every 60 minutes.
        // A user whose posting_time falls anywhere in the current local hour is considered due.
        const inWindow = (postingTime: string, timezone: string): boolean => {
          const localMinutes = getLocalMinutes(timezone || "UTC");
          const windowStart = Math.floor(localMinutes / 60) * 60; // top of the current local hour
          const windowEnd = windowStart + 60;
          const [h, m] = postingTime.split(":").map(Number);
          const postMinutes = h * 60 + m;
          return postMinutes >= windowStart && postMinutes < windowEnd;
        };

        // Fetch timezone alongside posting times so we can localise the check.
        const { data: profiles, error } = await supabaseAdmin
          .from("profiles")
          .select("user_id, posting_time, posting_times, timezone")
          .eq("active", true)
          .eq("onboarding_complete", true);

        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const due = (profiles ?? []).filter((p: any) => {
          const tz = p.timezone || "UTC";
          const list: string[] = p.posting_times?.length
            ? p.posting_times
            : p.posting_time
              ? [p.posting_time]
              : [];
          return list.some((t) => inWindow(t, tz));
        });

        const results: any[] = [];
        for (const p of due) {
          try {
            const r = await runDailyForUser({ userId: p.user_id, supabase: supabaseAdmin });
            results.push({ userId: p.user_id, ok: true, postIds: [r.brand?.id, r.personal?.id] });
          } catch (e) {
            results.push({ userId: p.user_id, ok: false, error: e instanceof Error ? e.message : String(e) });
          }
        }

        return Response.json({ processed: results.length, results });
      },
    },
  },
});
