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

        // Find active users with any posting_time in the current 15-min UTC window.
        const now = new Date();
        const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
        const windowStart = Math.floor(utcMinutes / 15) * 15;
        const windowEnd = windowStart + 15;
        const inWindow = (t: string) => {
          const [h, m] = t.split(":").map(Number);
          const mins = h * 60 + m;
          return mins >= windowStart && mins < windowEnd;
        };

        const { data: profiles, error } = await supabaseAdmin
          .from("profiles")
          .select("user_id, posting_time, posting_times")
          .eq("active", true)
          .eq("onboarding_complete", true);

        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const due = (profiles ?? []).filter((p: any) => {
          const list: string[] = p.posting_times?.length ? p.posting_times : (p.posting_time ? [p.posting_time] : []);
          return list.some(inWindow);
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
