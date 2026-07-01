// Server-only helper for Google Gemini API calls.
type SerperLike = {
  query: string;
  organic: { title: string; snippet: string }[];
  peopleAlsoAsk: { question: string; snippet?: string }[];
  related: string[];
};

export async function geminiGenerate(prompt: string, systemPrompt?: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };
  if (systemPrompt) {
    body.system_instruction = { parts: [{ text: systemPrompt }] };
  }

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");
  return text.trim();
}

type ProfileLike = {
  name: string | null;
  role: string | null;
  company: string | null;
  industry: string | null;
  description: string | null;
  tone: string | null;
  admired_brands: string[] | null;
  content_topics: string[] | null;
  twitter_handle: string | null;
};

function contextBlock(r1: SerperLike, r2: SerperLike) {
  const paa = [...r1.peopleAlsoAsk, ...r2.peopleAlsoAsk]
    .slice(0, 8)
    .map((p) => `- ${p.question}${p.snippet ? ` — ${p.snippet}` : ""}`)
    .join("\n");
  const titles = [...r1.organic, ...r2.organic]
    .slice(0, 10)
    .map((o) => `- ${o.title}: ${o.snippet}`)
    .join("\n");
  const related = [...r1.related, ...r2.related].slice(0, 8).join(", ");
  return `FEED 1 (${r1.query}):\n${r1.organic.map((o) => `${o.title} — ${o.snippet}`).join("\n")}\nPAA: ${r1.peopleAlsoAsk.map((p) => p.question).join(" | ")}\nRelated: ${r1.related.join(", ")}\n\nFEED 2 (${r2.query}):\n${r2.organic.map((o) => `${o.title} — ${o.snippet}`).join("\n")}\nPAA: ${r2.peopleAlsoAsk.map((p) => p.question).join(" | ")}\nRelated: ${r2.related.join(", ")}`;
}

export async function generateBrandPost(p: ProfileLike, r1: SerperLike, r2: SerperLike) {
  const companyName = p.company ?? "the company";
  const twitterHandle = p.twitter_handle ? `@${p.twitter_handle.replace(/^@/, "")}` : null;
  const followLine = twitterHandle
    ? `Follow ${twitterHandle} on X for daily bite-sized insights on retention and lifecycle marketing.`
    : "";

  const systemPrompt = `You are ${companyName}'s LinkedIn voice. ${companyName} is a ${p.industry ?? "marketing"} consultancy${p.description ? `. ${p.description}` : ""}.

Write a LinkedIn post of EXACTLY 250 to 300 words. This is a hard limit — the post must not exceed 300 words under any circumstances.

VOICE: Authoritative but human. Use real brand examples — Temu, ASOS, Monzo, Glossier, Duolingo, Klarna, Netflix, Shein, Spotify, Airbnb. Explain WHY each strategy works.

STRUCTURE: Open with the problem as a fact. Explain why it costs brands money. Name the common mistake brands make. Give the real answer with tactics and numbers. Use one recognisable brand as a real-world example. Give a numbered action plan of 3 steps. Close with one honest thought.

FORMAT: NO asterisks. NO bold. NO italic. NO dashes as bullets. NO markdown. Plain sentences and line breaks only. Action plan uses numbers (1. 2. 3.). 250 to 300 words — count carefully. End with 3 to 5 hashtags always including #${companyName.replace(/\s/g, "")}. ${followLine ? `Final line: ${followLine}` : ""}

OUTPUT: Plain text only. Strictly under 300 words.`;

  const userPrompt = `${contextBlock(r1, r2)}

INSTRUCTION: Pick the most interesting PAA question as the hook. Write the post as instructed in the system prompt. Then on a new line write: HOOK: <the exact PAA question you used>`;

  const out = await geminiGenerate(userPrompt, systemPrompt);
  return parseHook(out);
}

export async function generatePersonalPost(
  p: ProfileLike,
  r1: SerperLike,
  r2: SerperLike,
  rotatingBrand?: string,
) {
  const companyName = p.company ?? "the company";

  const systemPrompt = `You are ${p.name ?? "the user"}'s LinkedIn ghost writer. ${p.name} runs ${companyName}, a ${p.industry ?? "marketing"} consultancy. They explain brand psychology in a way that makes people say: oh, THAT is why I keep going back to that app.

VOICE: Conversational. Write like a knowledgeable friend talking to another marketer. Use second person — you, your brand. Explain WHY things work, not just what they are.

CONTENT: Pick ONE brand and build the entire post around it — use ${rotatingBrand ?? (p.admired_brands?.[0] ?? "a well-known consumer brand")} for this post. Never mention more than one brand. Open with a real scenario the reader has lived. Explain the psychology or strategy behind it using only that one brand as the example. Give at least one tactic with real numbers. End with a question inviting the reader to share their experience.

FORMAT: write the entire post in lowercase — every word, every sentence start — except brand names, abbreviations, and acronyms (e.g. ${companyName.replace(/\s/g, "")}, ASOS, UK, ROI). NO asterisks. NO bold. NO italic. NO dashes as bullets. NO markdown. Plain sentences and line breaks only. 150 to 250 words. End with 3 to 5 hashtags in normal casing, always including #${companyName.replace(/\s/g, "")}. Nothing after the hashtags.

OUTPUT: Plain text only.`;

  const userPrompt = `${contextBlock(r1, r2)}

INSTRUCTION: Pick the most interesting and specific PAA question. Write the short personal post as instructed in the system prompt. Then on a new line write: HOOK: <the exact PAA question you used>`;

  const out = await geminiGenerate(userPrompt, systemPrompt);
  return parseHook(out);
}

function parseHook(s: string): { content: string; hook: string } {
  const m = s.match(/^([\s\S]*?)\n+HOOK:\s*(.+)\s*$/i);
  if (m) return { content: m[1].trim(), hook: m[2].trim() };
  return { content: s.trim(), hook: "" };
}
