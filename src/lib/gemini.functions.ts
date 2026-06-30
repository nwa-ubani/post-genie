// Server-only helper for Google Gemini API calls.
type SerperLike = {
  query: string;
  organic: { title: string; snippet: string }[];
  peopleAlsoAsk: { question: string; snippet?: string }[];
  related: string[];
};

export async function geminiGenerate(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    },
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");
  return text.trim();
}

type ProfileLike = {
  name: string | null; role: string | null; company: string | null;
  industry: string | null; description: string | null; tone: string | null;
  admired_brands: string[] | null; content_topics: string[] | null;
};

function contextBlock(r1: SerperLike, r2: SerperLike) {
  const paa = [...r1.peopleAlsoAsk, ...r2.peopleAlsoAsk].slice(0, 6)
    .map((p) => `- ${p.question}${p.snippet ? ` — ${p.snippet}` : ""}`).join("\n");
  const titles = [...r1.organic, ...r2.organic].slice(0, 10)
    .map((o) => `- ${o.title}: ${o.snippet}`).join("\n");
  const related = [...r1.related, ...r2.related].slice(0, 8).join(", ");
  return `Live Google research:\n\nTop results:\n${titles}\n\nPeople Also Ask:\n${paa}\n\nRelated searches: ${related}`;
}

export async function generateBrandPost(p: ProfileLike, r1: SerperLike, r2: SerperLike) {
  const prompt = `You are writing a LinkedIn post for ${p.company} (${p.industry}).
${p.description ? `About the company: ${p.description}` : ""}

${contextBlock(r1, r2)}

Write Post A — an authoritative brand-voice LinkedIn post, 250–300 words.
- Pick ONE People Also Ask question as a hook (rephrase as a statement).
- Be concrete. No fluff, no emojis, no hashtags.
- End with a quick takeaway or question.
- Return ONLY the post text, then on a new line: HOOK: <the PAA question you used>`;
  const out = await geminiGenerate(prompt);
  return parseHook(out);
}

export async function generatePersonalPost(p: ProfileLike, r1: SerperLike, r2: SerperLike, rotatingBrand?: string) {
  const prompt = `You are writing as ${p.name}, ${p.role} at ${p.company}.
Tone: ${p.tone ?? "warm, candid"}.
Topics you care about: ${(p.content_topics ?? []).join(", ") || p.industry}.
${rotatingBrand ? `Reference ${rotatingBrand} naturally (1 line).` : ""}

${contextBlock(r1, r2)}

Write Post B — a personal LinkedIn post in your voice, 150–250 words.
- All lowercase. Short lines. No emojis. No hashtags.
- Pick one PAA question as a hook — answer it like a friend would.
- Sound like a real person, not a brand.
- Return ONLY the post text, then on a new line: HOOK: <the PAA question you used>`;
  const out = await geminiGenerate(prompt);
  return parseHook(out);
}

function parseHook(s: string): { content: string; hook: string } {
  const m = s.match(/^([\s\S]*?)\n+HOOK:\s*(.+)\s*$/i);
  if (m) return { content: m[1].trim(), hook: m[2].trim() };
  return { content: s.trim(), hook: "" };
}
