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
    // tbs:"qdr:m" restricts to past month — keeps results current
    body: JSON.stringify({ q: query, gl: "us", hl: "en", num: 10, tbs: "qdr:m" }),
  });
  if (!r.ok) throw new Error(`Serper ${r.status}`);
  const j = await r.json();
  return {
    query,
    organic: (j.organic ?? []).slice(0, 8).map((o: any) => ({
      title: o.title,
      snippet: o.snippet,
      link: o.link,
    })),
    peopleAlsoAsk: (j.peopleAlsoAsk ?? []).map((p: any) => ({
      question: p.question,
      snippet: p.snippet,
    })),
    related: (j.relatedSearches ?? []).map((r: any) => r.query),
  };
}

export const runSerperForProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
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

/**
 * Build two Serper queries that are:
 * 1. Driven by the user's actual content topics — not generic/hardcoded angles
 * 2. Different every day via 6 rotating strategy templates
 * 3. Personalised by industry, role, and admired brands
 *
 * A fitness coach with topics ["nutrition", "recovery"] gets completely different
 * queries than a marketer with topics ["email marketing", "retention"].
 */
export function buildQueries(
  profile: {
    industry?: string | null;
    content_topics?: string[] | null;
    admired_brands?: string[] | null;
    role?: string | null;
    company?: string | null;
  },
  dayOfYear: number,
): { q1: string; q2: string } {
  const industry = profile.industry ?? "business";
  const topics = profile.content_topics?.length ? profile.content_topics : [industry];

  // Rotate through the user's own topics day by day
  const primary = topics[dayOfYear % topics.length];
  const secondary = topics[(dayOfYear + 1) % topics.length];

  const brands = profile.admired_brands?.length ? profile.admired_brands : [];
  const brand = brands.length ? brands[dayOfYear % brands.length] : null;

  const role = profile.role ?? "expert";

  // 6 strategy templates — all filled with the user's actual topics, not hardcoded angles
  const strategies: { q1: string; q2: string }[] = [
    {
      q1: `${primary} mistakes people and businesses make`,
      q2: `${primary} best practices in ${industry} right now`,
    },
    {
      q1: `why ${primary} is changing in ${industry}`,
      q2: `${secondary} questions ${industry} professionals are asking`,
    },
    {
      q1: `${brand ? `how ${brand} approaches ${primary}` : `${primary} case study results`}`,
      q2: `${industry} ${primary} what the data shows`,
    },
    {
      q1: `how to improve ${primary} step by step`,
      q2: `${secondary} common problems and how to fix them`,
    },
    {
      q1: `${primary} trends in ${industry} this year`,
      q2: `${industry} ${secondary} what experts say works`,
    },
    {
      q1: `${primary} real examples and lessons learned`,
      q2: `${role} advice on ${primary} for ${industry}`,
    },
  ];

  return strategies[dayOfYear % strategies.length];
}
