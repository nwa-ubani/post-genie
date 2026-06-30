import { createFileRoute } from "@tanstack/react-router";
import { runDailyForUser } from "@/lib/posts.functions";

export const Route = createFileRoute("/api/public/cron/daily-posts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        if (!apiKey || apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Find users whose posting_time falls within the current 15-min window.
        // Naive: ignore per-user timezone for now — use UTC. The user's posting_time is stored as TIME.
        const now = new Date();
        const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
        const windowStart = Math.floor(utcMinutes / 15) * 15;
        const windowEnd = windowStart + 15;
        const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;

        const { data: profiles, error } = await supabaseAdmin
          .from("profiles")
          .select("user_id, posting_time")
          .eq("active", true)
          .eq("onboarding_complete", true)
          .gte("posting_time", fmt(windowStart))
          .lt("posting_time", fmt(windowEnd));

        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const results: any[] = [];
        for (const p of profiles ?? []) {
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
