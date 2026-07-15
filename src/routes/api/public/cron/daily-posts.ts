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
            return now.getUTCHours() * 60 + now.getUTCMinutes();
          }
        };

        // Window is now 15 min (Make.com fires every 15 minutes).
        const inWindow = (postingTime: string, timezone: string): boolean => {
          const localMinutes = getLocalMinutes(timezone || "UTC");
          const windowStart = Math.floor(localMinutes / 15) * 15;
          const windowEnd = windowStart + 15;
          const [h, m] = postingTime.split(":").map(Number);
          const postMinutes = h * 60 + m;
          return postMinutes >= windowStart && postMinutes < windowEnd;
        };

        const getLocalDayIndex = (timezone: string): number => {
          try {
            const parts = new Intl.DateTimeFormat("en-US", {
              timeZone: timezone || "UTC",
              weekday: "short",
            }).formatToParts(now);
            const weekdayName = parts.find((p) => p.type === "weekday")?.value ?? "";
            return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);
          } catch {
            return -1;
          }
        };

        const { data: profiles, error } = await supabaseAdmin
          .from("profiles")
          .select("user_id, posting_time, posting_times, timezone, posting_days, posting_schedule")
          .eq("active", true)
          .eq("onboarding_complete", true);

        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const due = (profiles ?? []).filter((p: any) => {
          const tz = p.timezone || "UTC";
          const dayIndex = getLocalDayIndex(tz);

          // Prefer per-day posting_schedule when present
          const schedule = p.posting_schedule as Record<string, string[]> | null | undefined;
          if (schedule && typeof schedule === "object" && Object.keys(schedule).length) {
            if (dayIndex < 0) return false;
            const times = schedule[String(dayIndex)] ?? [];
            return times.some((t) => inWindow(t, tz));
          }

          // Legacy fallback
          if (p.posting_days?.length) {
            if (dayIndex < 0 || !p.posting_days.includes(dayIndex)) return false;
          }
          const list: string[] = p.posting_times?.length
            ? p.posting_times
            : p.posting_time
              ? [p.posting_time]
              : [];
          return list.some((t) => inWindow(t, tz));
        });

        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const due = (profiles ?? []).filter((p: any) => {
          const tz = p.timezone || "UTC";
          if (!isDueToday(p.posting_days ?? null, tz)) return false;
          const list: string[] = p.posting_times?.length
            ? p.posting_times
            : p.posting_time
              ? [p.posting_time]
              : [];
          return list.some((t) => inWindow(t, tz));
        });

        const results: any[] = [];
        for (const p of due) {
          // Dedup: skip if a post was already created in the last 20 minutes
          const { data: recentPost } = await supabaseAdmin
            .from("posts")
            .select("id")
            .eq("user_id", p.user_id)
            .gte("created_at", new Date(Date.now() - 20 * 60 * 1000).toISOString())
            .limit(1)
            .maybeSingle();

          if (recentPost) {
            results.push({ userId: p.user_id, ok: true, skipped: true, reason: "already posted in last 20 min" });
            continue;
          }

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
