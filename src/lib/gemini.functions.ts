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

export async function generateBrandPost(
  p: ProfileLike,
  r1: SerperLike,
  r2: SerperLike,
  roleModelSamples: string[] = [],
) {
  const companyName = p.company ?? "the company";
  const industry = p.industry ?? "their industry";
  const topics = p.content_topics?.length ? p.content_topics.join(", ") : industry;

  const systemPrompt = `You are ${companyName}'s LinkedIn voice. ${companyName} works in ${industry}${p.description ? `. ${p.description}` : ""}.

Write a LinkedIn post of 250 to 300 words. Hard limit — never exceed 300 words.

GROUNDING (CRITICAL): The user prompt contains live Google search results about ${industry} and ${topics}. Build the entire post from those results. Pull concrete facts, numbers, examples, and questions directly from the feed. Do NOT invent examples. Do NOT default to generic marketing/consumer brand references unless they actually appear in the feed. Match the industry of the feed, not a template.

VOICE: Authoritative but human. Tone: ${p.tone ?? "clear and confident"}. Explain WHY things work using evidence from the feed.

CAPITALIZATION: Standard sentence case. Every sentence and paragraph begins with a capital letter. Proper nouns capitalized normally.

STRUCTURE: Open with a problem or insight from the feed. Explain why it matters in ${industry}. Name a common mistake. Give the real answer with tactics/numbers from the feed. Reference one real example that appears in the feed. Numbered action plan of 3 steps. Close with one honest thought.

FORMAT: NO asterisks, bold, italic, markdown, or dash bullets. Plain sentences and line breaks. Action plan uses 1. 2. 3. End with 3–5 hashtags including #${companyName.replace(/\s/g, "")}.

OUTPUT: Plain text only. Under 300 words. No follow/subscribe lines.${styleBlock(p, roleModelSamples)}`;

  const userPrompt = `${contextBlock(r1, r2)}

INSTRUCTION: Pick the most interesting PAA question above as your hook. Ground every claim, example, and number in the feed above. Write the post. Then on a new line write: HOOK: <the exact PAA question you used>`;

  const out = await geminiGenerate(userPrompt, systemPrompt);
  return parseHook(out);
}

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
  const hashtagHandle = companyName ? `#${companyName.replace(/\s/g, "")}` : `#${industry.replace(/\s/g, "")}`;

  const systemPrompt = `You are ${p.name ?? "the user"}'s LinkedIn ghost writer. ${p.name ?? "They"} work${p.name ? "s" : ""} in ${industry}${p.role ? ` as ${p.role}` : ""}${companyName ? ` at ${companyName}` : ""}.

GROUNDING (CRITICAL): The user prompt contains live Google search results about ${industry} and ${topics}. Build the whole post from that feed. Pull the scenario, the facts, the numbers, and the example directly from the search results. Do NOT invent brands or examples that aren't in the feed. Match the industry of the feed exactly.

VOICE: Conversational. Tone: ${p.tone ?? "warm and clear"}. Second person — you, your. Explain WHY, not just what.

CAPITALIZATION: Standard sentence case. Every sentence and paragraph begins with a capital letter. Proper nouns and brand names capitalized normally. (Only go fully lowercase if the user's additional instructions explicitly request it.)

CONTENT: Pick ONE example from the feed${rotatingBrand ? ` (if ${rotatingBrand} appears in the feed, prefer it)` : ""}. Build the whole post around that one example. Open with a real scenario the reader in ${industry} has lived. Explain the psychology/strategy using only that example. Include at least one tactic with a real number from the feed. End with a question inviting the reader to share their experience.

FORMAT: NO asterisks, bold, italic, markdown, or dash bullets. Plain sentences and line breaks. 150–250 words. End with 3–5 hashtags including ${hashtagHandle}. Nothing after hashtags.

OUTPUT: Plain text only.${styleBlock(p, roleModelSamples)}`;

  const userPrompt = `${contextBlock(r1, r2)}

INSTRUCTION: Pick the most interesting and specific PAA question above. Ground every claim and example in the feed above. Write the post. Then on a new line write: HOOK: <the exact PAA question you used>`;

  const out = await geminiGenerate(userPrompt, systemPrompt);
  return parseHook(out);
}

function parseHook(s: string): { content: string; hook: string } {
  const m = s.match(/^([\s\S]*?)\n+HOOK:\s*(.+)\s*$/i);
  if (m) return { content: m[1].trim(), hook: m[2].trim() };
  return { content: s.trim(), hook: "" };
}
