import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geminiGenerate } from "@/lib/gemini.functions";

type Field =
  | "role"
  | "company"
  | "industry"
  | "description"
  | "brands"
  | "topics"
  | "tone";

const FIELD_PROMPTS: Record<Field, (ctx: string) => { system: string; user: string }> = {
  role: (ctx) => ({
    system: "You suggest concise job titles. Reply with ONLY the title, 2-5 words, no quotes, no explanation.",
    user: `Based on this profile so far, suggest one likely job title:\n${ctx}`,
  }),
  company: (ctx) => ({
    system: "You suggest a plausible short company name. Reply with ONLY the name, no quotes, no explanation.",
    user: `Based on this profile so far, suggest one company name:\n${ctx}`,
  }),
  industry: (ctx) => ({
    system: "You suggest an industry in 1-3 words. Reply with ONLY the industry, no quotes.",
    user: `Based on this profile so far, suggest the industry:\n${ctx}`,
  }),
  description: (ctx) => ({
    system: "You write short company descriptions. Reply with ONLY 2-3 plain sentences, no markdown, no quotes.",
    user: `Write a 2-3 sentence company description in plain English:\n${ctx}`,
  }),
  brands: (ctx) => ({
    system: "You suggest 5 admired brands as a plain comma-separated list. Reply with ONLY the list, no explanation.",
    user: `Suggest 5 well-known brands this person would admire (comma-separated):\n${ctx}`,
  }),
  topics: (ctx) => ({
    system: "You suggest 5 LinkedIn content topics as a comma-separated list. Reply with ONLY the list.",
    user: `Suggest 5 LinkedIn content topics this person should post about (comma-separated):\n${ctx}`,
  }),
  tone: (ctx) => ({
    system: "You suggest 3 tones from this exact list: Authoritative, Friendly, Witty, Bold, Warm, Analytical. Reply with ONLY 3 tone names comma-separated.",
    user: `Pick 3 tones that best fit this person (comma-separated):\n${ctx}`,
  }),
};

export const suggestField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { field: Field; context: Record<string, unknown> }) => d)
  .handler(async ({ data }) => {
    const ctx = Object.entries(data.context)
      .filter(([, v]) => v && (Array.isArray(v) ? v.length : String(v).trim()))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\n") || "(no info yet — make a reasonable general suggestion)";
    const p = FIELD_PROMPTS[data.field](ctx);
    const out = await geminiGenerate(p.user, p.system);
    return { suggestion: out.replace(/^["']|["']$/g, "").trim() };
  });
