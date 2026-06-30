import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SerperResult = {
  query: string;
  organic: { title: string; snippet: string; link: string }[];
  peopleAlsoAsk: { question: string; snippet?: string }[];
  related: string[];
};

export async function searchSerper(query: string): Promise<SerperResult> {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("SERPER_API_KEY not configured");
  const r = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "us", hl: "en", num: 10 }),
  });
  if (!r.ok) throw new Error(`Serper ${r.status}`);
  const j = await r.json();
  return {
    query,
    organic: (j.organic ?? []).slice(0, 8).map((o: any) => ({ title: o.title, snippet: o.snippet, link: o.link })),
    peopleAlsoAsk: (j.peopleAlsoAsk ?? []).map((p: any) => ({ question: p.question, snippet: p.snippet })),
    related: (j.relatedSearches ?? []).map((r: any) => r.query),
  };
}

export const runSerperForProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
    if (!profile) throw new Error("Profile not found");
    const q1 = `${profile.industry} trends ${new Date().getFullYear()}`;
    const q2 = profile.content_topics?.[0]
      ? `${profile.content_topics[0]} ${profile.industry}`
      : `${profile.company} ${profile.industry}`;
    const [r1, r2] = await Promise.all([searchSerper(q1), searchSerper(q2)]);
    await supabase.from("search_cache").insert([
      { user_id: userId, query: q1, results: r1 as any },
      { user_id: userId, query: q2, results: r2 as any },
    ]);
    return { r1, r2 };
  });
