// Server-only helper for Google Gemini API calls.
type SerperLike = {
  query: string;
  organic: { title: string; snippet: string }[];
  peopleAlsoAsk: { question: string; snippet?: string }[];
  related: string[];
};

export async function geminiGenerate(prompt: string, systemPrompt?: string): Promise<string> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY not configured");

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
  custom_instructions?: string | null;
  writing_samples?: string[] | null;
};

function contextBlock(r1: SerperLike, r2: SerperLike) {
  return `FEED 1 (${r1.query}):\n${r1.organic.map((o) => `${o.title} — ${o.snippet}`).join("\n")}\nPAA: ${r1.peopleAlsoAsk.map((p) => p.question).join(" | ")}\nRelated: ${r1.related.join(", ")}\n\nFEED 2 (${r2.query}):\n${r2.organic.map((o) => `${o.title} — ${o.snippet}`).join("\n")}\nPAA: ${r2.peopleAlsoAsk.map((p) => p.question).join(" | ")}\nRelated: ${r2.related.join(", ")}`;
}

function styleBlock(p: ProfileLike, roleModelSamples: string[]) {
  const parts: string[] = [];
  if (p.writing_samples?.length) {
    parts.push(`USER'S OWN WRITING SAMPLES (mimic sentence rhythm, vocabulary, and structure):\n${p.writing_samples.map((s, i) => `Sample ${i + 1}: ${s}`).join("\n\n")}`);
  }
  if (roleModelSamples.length) {
    parts.push(`ROLE-MODEL WRITING (study voice, cadence, and how they frame ideas — do not copy content, only style):\n${roleModelSamples.map((s, i) => `Reference ${i + 1}: ${s}`).join("\n\n")}`);
  }
  if (p.custom_instructions?.trim()) {
    parts.push(`ADDITIONAL USER INSTRUCTIONS (highest priority — override defaults below if they conflict):\n${p.custom_instructions.trim()}`);
  }
  return parts.length ? `\n\n${parts.join("\n\n")}` : "";
}

/** Returns the day-of-year (1–365) — used for format and angle rotation. */
function getDayOfYear(): number {
  return Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
}

// ─── Brand / Company page post ────────────────────────────────────────────────

export async function generateBrandPost(
  p: ProfileLike,
  r1: SerperLike,
  r2: SerperLike,
  roleModelSamples: string[] = [],
) {
  const companyName = p.company ?? "the company";
  const industry = p.industry ?? "their industry";
  const topics = p.content_topics?.length ? p.content_topics.join(", ") : industry;

  const day = getDayOfYear();

  // 3 content formats — rotate daily so every post has a different structure
  const brandFormats = [
    `analytical insight — open with a surprising or counter-intuitive finding from the feed, explain what it really means for ${industry} brands, close with one sharp strategic takeaway`,
    `practical how-to — walk through a step-by-step approach to solving one specific, concrete problem brands in ${industry} face right now; ground every step in the feed data`,
    `case study breakdown — examine a real example or brand decision from the feed (keep the brand unnamed if needed), explain the logic behind it, extract the transferable lesson`,
  ];

  // 5 opening angles — rotate independently so format + angle combinations vary across 15 days
  const brandAngles = [
    `a surprising or counter-intuitive finding from the feed that challenges what most ${industry} brands assume`,
    `a contrarian take — go against the most common piece of advice in ${industry} and explain why the feed points to a different conclusion`,
    `a real customer or brand scenario from the feed that reveals a gap most ${industry} brands miss until it costs them`,
    `a decision or outcome from the feed that produced an unexpected result — either surprisingly good or quietly damaging`,
    `a direct, pointed question to the reader that makes them confront a problem the feed shows they've been avoiding`,
  ];

  const contentFormat = brandFormats[day % brandFormats.length];
  const openingAngle = brandAngles[day % brandAngles.length];

  const systemPrompt = `You are ${companyName}'s LinkedIn voice. ${companyName} works in ${industry}${p.description ? `. ${p.description}` : ""}.

POSITIONING GOAL: Every post must leave the reader thinking "${companyName} understands this at a level most consultancies don't — they're exactly who I'd bring in." Demonstrate depth through specificity and evidence. Never claim authority directly.

GROUNDING (CRITICAL): The user prompt contains live Google search results about ${industry} and ${topics}. Build the entire post from those results. Pull concrete facts, numbers, examples, and questions directly from the feed. Do NOT invent examples or default to generic references that aren't in the feed.

CONTENT FORMAT FOR TODAY: ${contentFormat}

OPENING ANGLE FOR TODAY: Start with ${openingAngle}

VOICE: Authoritative but grounded. Tone: ${p.tone ?? "clear and confident"}. Explain WHY things work using evidence from the feed. Avoid AI clichés: no "In today's fast-paced world", no "It's no secret that", no "Game-changer", no "Let's be honest", no formulaic wrap-ups, no "In conclusion".

WORD COUNT: 250 to 300 words — hard limit. Count before you finish.

FORMAT: NO asterisks, bold, italic, markdown, or dash bullets. Plain sentences and line breaks. Numbered steps use 1. 2. 3. End with 3–5 hashtags including #${companyName.replace(/\s/g, "")}.

OUTPUT: Plain text only. Under 300 words. No follow/subscribe lines.${styleBlock(p, roleModelSamples)}`;

  const userPrompt = `${contextBlock(r1, r2)}

INSTRUCTION: Pick the most interesting PAA question above as your hook. Ground every claim, example, and number in the feed above. Write the post following the system prompt exactly. Then on a new line write: HOOK: <the exact PAA question you used>`;

  const out = await geminiGenerate(userPrompt, systemPrompt);
  return parseHook(out);
}

// ─── Personal post ────────────────────────────────────────────────────────────

export async function generatePersonalPost(
  p: ProfileLike,
  r1: SerperLike,
  r2: SerperLike,
  rotatingBrand?: string,
  roleModelSamples: string[] = [],
) {
  const companyName = p.company ?? "";
  const industry = p.industry ?? "their industry";
  const topics = p.content_topics?.length ? p.content_topics.join(", ") : industry;
  const hashtagHandle = companyName
    ? `#${companyName.replace(/\s/g, "")}`
    : `#${industry.replace(/\s/g, "")}`;

  const day = getDayOfYear();

  // 3 content formats — rotate daily for structural variety
  const personalFormats = [
    `brand story — take one specific behaviour, design choice, or campaign from the feed, explain the psychology behind why it works (or doesn't), make the reader see something familiar in a completely new way`,
    `how-to guide — teach one specific, actionable tactic from the feed step by step, something the reader in ${industry} could realistically start applying this week`,
    `myth-busting — identify one widely held belief or piece of conventional advice that the feed contradicts, show why the conventional wisdom is wrong or incomplete, give the better alternative`,
  ];

  const contentFormat = personalFormats[day % personalFormats.length];

  const systemPrompt = `You are ${p.name ?? "the user"}'s LinkedIn ghost writer. ${p.name ?? "They"} work${p.name ? "s" : ""} in ${industry}${p.role ? ` as ${p.role}` : ""}${companyName ? ` at ${companyName}` : ""}.

POSITIONING GOAL: Every post must make the reader think "${p.name ?? "this person"} sees things others miss — they're exactly who I'd want working on my ${industry} problems." Show it through depth and specificity, never by saying it directly.

GROUNDING (CRITICAL): The user prompt contains live Google search results about ${industry} and ${topics}. Build the whole post from that feed. Pull the scenario, the facts, the numbers, and the example directly from the search results. Do NOT invent brands or examples that aren't in the feed.

CONTENT FORMAT FOR TODAY: ${contentFormat}

INSPIRATION BRAND (use only if the example is accurate and strong): ${rotatingBrand ?? "any brand that appears in the feed"}.
If the brand is in the feed with a solid example, use it. If not, say "one brand in this space" or "a company that got this right" — never name a brand you're not confident about.

VOICE: Conversational. Tone: ${p.tone ?? "warm and clear"}. Second person — you, your. Explain WHY, not just what. Avoid AI clichés: no "In today's world", no "Let's talk about", no "Here's what I've learned:", no generic "What do you think?" endings.

CAPITALIZATION: Standard sentence case. Every sentence and paragraph begins with a capital letter. Proper nouns and brand names capitalized normally. (Only go fully lowercase if the user's additional instructions explicitly request it.)

FORMAT: NO asterisks, bold, italic, markdown, or dash bullets. Plain sentences and line breaks. 150–250 words. End with 3–5 hashtags including ${hashtagHandle}. Nothing after hashtags.

OUTPUT: Plain text only.${styleBlock(p, roleModelSamples)}`;

  const userPrompt = `${contextBlock(r1, r2)}

INSTRUCTION: Pick the most specific and interesting PAA question above. Ground every claim and example in the feed above. Write the post following the system prompt exactly. Then on a new line write: HOOK: <the exact PAA question you used>`;

  const out = await geminiGenerate(userPrompt, systemPrompt);
  return parseHook(out);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseHook(s: string): { content: string; hook: string } {
  const m = s.match(/^([\s\S]*?)\n+HOOK:\s*(.+)\s*$/i);
  if (m) return { content: m[1].trim(), hook: m[2].trim() };
  return { content: s.trim(), hook: "" };
}
