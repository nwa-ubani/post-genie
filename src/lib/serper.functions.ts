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
    // tbs:"qdr:m" restricts results to the past month — keeps content fresh and current
    body: JSON.stringify({ q: query, gl: "us", hl: "en", num: 10, tbs: "qdr:m" }),
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
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    );
    const { q1, q2 } = buildQueries(profile, dayOfYear);
    const [r1, r2] = await Promise.all([searchSerper(q1), searchSerper(q2)]);
    await supabase.from("search_cache").insert([
      { user_id: userId, query: q1, results: r1 as any },
      { user_id: userId, query: q2, results: r2 as any },
    ]);
    return { r1, r2 };
  });

export function buildQueries(
  profile: { industry?: string | null; content_topics?: string[] | null; admired_brands?: string[] | null; company?: string | null },
  dayOfYear: number,
): { q1: string; q2: string } {
  const industry = profile.industry ?? "marketing";
  const topics = profile.content_topics?.length ? profile.content_topics : [industry];
  const primaryTopic = topics[dayOfYear % topics.length];
  const secondaryTopic = topics[(dayOfYear + 1) % topics.length];
  const brands = profile.admired_brands?.length ? profile.admired_brands : [];
  const rotatingBrand = brands.length ? brands[dayOfYear % brands.length] : null;

  // 6 strategies rotate by day — each gives Gemini genuinely different angles and PAA questions
  const strategies = [
    {
      q1: `why do customers stop buying from ${industry} brands`,
      q2: `${primaryTopic} what makes customers come back`,
    },
    {
      q1: `${primaryTopic} mistakes brands make losing customers`,
      q2: `${industry} retention strategies that actually work`,
    },
    {
      q1: `${rotatingBrand ?? primaryTopic} marketing strategy how they keep customers`,
      q2: `${industry} consumer psychology buying behaviour`,
    },
    {
      q1: `how to increase customer lifetime value ${primaryTopic}`,
      q2: `${secondaryTopic} brand loyalty what drives it`,
    },
    {
      q1: `${primaryTopic} trends what top brands are doing differently`,
      q2: `${industry} churn rate how to reduce it`,
    },
    {
      q1: `${primaryTopic} and ${secondaryTopic} examples that worked`,
      q2: `${industry} brands growing fastest right now and why`,
    },
  ];

  return strategies[dayOfYear % strategies.length];
}
