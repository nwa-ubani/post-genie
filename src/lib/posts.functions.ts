import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { searchSerper } from "@/lib/serper.functions";
import { generateBrandPost, generatePersonalPost } from "@/lib/gemini.functions";
import { publishToLinkedIn } from "@/lib/linkedin.functions";

export async function runDailyForUser(opts: {
  userId: string;
  supabase: any;
  preview?: boolean;
}) {
  const { userId, supabase, preview = false } = opts;
  const { data: profile, error: pErr } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
  if (pErr || !profile) throw new Error("Profile not found");

  const q1 = `${profile.industry} trends ${new Date().getFullYear()}`;
  const q2 = profile.content_topics?.[0]
    ? `${profile.content_topics[0]} ${profile.industry}`
    : `${profile.company} ${profile.industry}`;
  const [r1, r2] = await Promise.all([searchSerper(q1), searchSerper(q2)]);
  await supabase.from("search_cache").insert([
    { user_id: userId, query: q1, results: r1 },
    { user_id: userId, query: q2, results: r2 },
  ]);

  const rotatingBrand = profile.admired_brands?.length
    ? profile.admired_brands[Math.floor(Date.now() / 86400000) % profile.admired_brands.length]
    : undefined;

  const [brand, personal] = await Promise.all([
    generateBrandPost(profile, r1, r2),
    generatePersonalPost(profile, r1, r2, rotatingBrand),
  ]);

  // Pick a photo (not yesterday's)
  const { data: photos } = await supabase.from("photos").select("*").eq("user_id", userId);
  let photoId: string | null = null;
  if (photos?.length) {
    const yesterday = Date.now() - 86400000;
    const eligible = photos.filter((p: any) => !p.last_used_at || new Date(p.last_used_at).getTime() < yesterday);
    const pick = (eligible.length ? eligible : photos)[Math.floor(Math.random() * (eligible.length || photos.length))];
    photoId = pick.id;
    await supabase.from("photos").update({ last_used_at: new Date().toISOString() }).eq("id", pick.id);
  }

  const now = new Date().toISOString();

  // Insert brand post (status pending — handed off via Make.com)
  const { data: brandRow } = await supabase.from("posts").insert({
    user_id: userId, post_type: "brand", content: brand.content,
    keyword_hook: brand.hook, serper_data: { q1, q2 },
    scheduled_for: now, status: preview ? "draft" : "pending",
  }).select().single();

  const { data: personalRow } = await supabase.from("posts").insert({
    user_id: userId, post_type: "personal", content: personal.content,
    photo_id: photoId, keyword_hook: personal.hook, serper_data: { q1, q2 },
    scheduled_for: now, status: preview ? "draft" : "pending",
  }).select().single();

  if (preview) return { brand: brandRow, personal: personalRow };

  // Hand brand post to Make.com if configured
  if (profile.make_webhook_url) {
    try {
      await fetch(profile.make_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: { name: profile.name, company: profile.company },
          post_content: brand.content,
          keyword_hook: brand.hook,
          scheduled_for: now,
        }),
      });
      await supabase.from("posts").update({ status: "published", published_at: now }).eq("id", brandRow.id);
    } catch (e) {
      await supabase.from("posts").update({ status: "failed", error: e instanceof Error ? e.message : String(e) }).eq("id", brandRow.id);
    }
  }

  // Publish personal to LinkedIn
  const { data: tokens } = await supabase.from("linkedin_tokens").select("*").eq("user_id", userId).maybeSingle();
  if (tokens?.access_token && tokens?.linkedin_member_urn) {
    try {
      const { urn } = await publishToLinkedIn(tokens.access_token, tokens.linkedin_member_urn, personal.content);
      await supabase.from("posts").update({ status: "published", published_at: now, linkedin_post_urn: urn }).eq("id", personalRow.id);
    } catch (e) {
      await supabase.from("posts").update({ status: "failed", error: e instanceof Error ? e.message : String(e) }).eq("id", personalRow.id);
    }
  } else {
    await supabase.from("posts").update({ status: "failed", error: "LinkedIn not connected" }).eq("id", personalRow.id);
  }

  return { brand: brandRow, personal: personalRow };
}

export const runForCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { preview?: boolean } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    return runDailyForUser({ userId: context.userId, supabase: context.supabase, preview: data.preview });
  });
