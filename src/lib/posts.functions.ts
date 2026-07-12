import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { searchSerper, buildQueries } from "@/lib/serper.functions";
import { generateBrandPost, generatePersonalPost } from "@/lib/gemini.functions";
import { publishToLinkedIn, publishImageToLinkedIn, publishVideoToLinkedIn } from "@/lib/linkedin.functions";
import { fetchStyleSamples } from "@/lib/style-scrape.functions";

export async function runDailyForUser(opts: {
  userId: string;
  supabase: any;
  preview?: boolean;
}) {
  const { userId, supabase, preview = false } = opts;

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (pErr || !profile) throw new Error("Profile not found");

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );

  const brands = profile.admired_brands?.length ? profile.admired_brands : [];
  const rotatingBrand = brands.length ? brands[dayOfYear % brands.length] : undefined;

  const { q1, q2 } = buildQueries(profile, dayOfYear);
  const [r1, r2, roleModelSamples] = await Promise.all([
    searchSerper(q1),
    searchSerper(q2),
    fetchStyleSamples(profile.role_model_urls),
  ]);

  await supabase.from("search_cache").insert([
    { user_id: userId, query: q1, results: r1 },
    { user_id: userId, query: q2, results: r2 },
  ]);

  // Only generate a brand post if the user has a company AND a way to publish it
  // (company page URL or Make.com webhook). Otherwise skip — personal post only.
  const shouldGenerateBrand =
    !!profile.company?.trim() &&
    (!!profile.make_webhook_url?.trim() || !!profile.linkedin_company_url?.trim());

  const [brand, personal] = await Promise.all([
    shouldGenerateBrand ? generateBrandPost(profile, r1, r2, roleModelSamples) : Promise.resolve(null),
    generatePersonalPost(profile, r1, r2, rotatingBrand, roleModelSamples),
  ]);

  const { data: photos } = await supabase
    .from("photos")
    .select("*")
    .eq("user_id", userId);

  let photoId: string | null = null;
  let photoPath: string | null = null;
  let photoMediaType: "image" | "video" = "image";
  let photoContentType: string = "image/jpeg";

  if (photos?.length) {
    const yesterday = Date.now() - 86400000;
    const eligible = photos.filter(
      (p: any) => !p.last_used_at || new Date(p.last_used_at).getTime() < yesterday,
    );
    const pool = eligible.length ? eligible : photos;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    photoId = pick.id;
    photoPath = pick.file_path;
    photoMediaType = pick.media_type === "video" ? "video" : "image";
    photoContentType = pick.content_type ?? (photoMediaType === "video" ? "video/mp4" : "image/jpeg");
    if (!preview) {
      await supabase
        .from("photos")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", pick.id);
    }
  }


  const now = new Date().toISOString();

  let brandRow: any = null;
  if (brand) {
    const { data } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        post_type: "brand",
        content: brand.content,
        keyword_hook: brand.hook,
        serper_data: { q1, q2 },
        scheduled_for: now,
        status: preview ? "draft" : "pending",
      })
      .select()
      .single();
    brandRow = data;
  }

  const { data: personalRow } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      post_type: "personal",
      content: personal.content,
      photo_id: photoId,
      keyword_hook: personal.hook,
      serper_data: { q1, q2 },
      scheduled_for: now,
      status: preview ? "draft" : "pending",
    })
    .select()
    .single();

  if (preview) return { brand: brandRow, personal: personalRow, photoPath };

  const notify = async (title: string, body: string, url = "/dashboard", tag?: string) => {
    try {
      const { sendPushToUser } = await import("./push-send.server");
      await sendPushToUser(userId, { title, body, url, tag });
    } catch (err) {
      console.error("push notify failed", err);
    }
  };

  if (brandRow && profile.make_webhook_url) {
    try {
      const { safeFetch } = await import("./ssrf-guard.server");
      const webhookRes = await safeFetch(profile.make_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: { name: profile.name, company: profile.company },
          post_content: brand!.content,
          keyword_hook: brand!.hook,
          scheduled_for: now,
        }),
      });
      if (!webhookRes.ok) throw new Error(`Webhook ${webhookRes.status}`);
      await supabase
        .from("posts")
        .update({ status: "published", published_at: now })
        .eq("id", brandRow.id);
      if (profile.notify_post_published !== false) {
        await notify("Brand post sent 📣", "Handed off your company post to Make.com.", "/dashboard", "post-brand");
      }
    } catch (e) {
      const safe = e instanceof Error && /private|reserved|not allowed|Invalid URL|resolve/i.test(e.message)
        ? "Webhook URL not allowed"
        : "Webhook delivery failed";
      await supabase
        .from("posts")
        .update({ status: "failed", error: safe })
        .eq("id", brandRow.id);
      if (profile.notify_post_failed !== false) {
        await notify("Brand post failed ⚠️", safe, "/dashboard", "post-brand-fail");
      }
    }
  }

  const { data: tokens } = await supabase
    .from("linkedin_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Token expiry warning: notify once when < 7 days remain.
  if (tokens?.expires_at && profile.notify_token_expiring !== false) {
    const ms = new Date(tokens.expires_at).getTime() - Date.now();
    const days = ms / 86400000;
    if (days > 0 && days < 7) {
      await notify(
        "LinkedIn reconnect needed soon 🔑",
        `Your LinkedIn access expires in ${Math.ceil(days)} day${Math.ceil(days) === 1 ? "" : "s"}. Reconnect from Settings.`,
        "/settings",
        "linkedin-expiring",
      );
    }
  }

  if (tokens?.access_token && tokens?.linkedin_member_urn) {
    try {
      let urn = "";
      if (photoPath) {
        const { data: fileData, error: dlErr } = await supabase.storage
          .from("photos")
          .download(photoPath);
        if (dlErr || !fileData) throw new Error(`Could not download media: ${dlErr?.message}`);
        const buffer = await fileData.arrayBuffer();
        const result = photoMediaType === "video"
          ? await publishVideoToLinkedIn(tokens.access_token, tokens.linkedin_member_urn, personal.content, buffer, photoContentType)
          : await publishImageToLinkedIn(tokens.access_token, tokens.linkedin_member_urn, personal.content, buffer);
        urn = result.urn;
      } else {
        const result = await publishToLinkedIn(
          tokens.access_token,
          tokens.linkedin_member_urn,
          personal.content,
        );
        urn = result.urn;
      }

      await supabase
        .from("posts")
        .update({ status: "published", published_at: now, linkedin_post_urn: urn })
        .eq("id", personalRow.id);
      if (profile.notify_post_published !== false) {
        const preview = (personal.content ?? "").slice(0, 90);
        await notify(
          "Today's post is live on LinkedIn ✅",
          preview + ((personal.content ?? "").length > 90 ? "…" : ""),
          "/dashboard",
          "post-personal",
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("posts")
        .update({ status: "failed", error: msg })
        .eq("id", personalRow.id);
      if (profile.notify_post_failed !== false) {
        await notify("Today's post failed ⚠️", msg.slice(0, 140), "/dashboard", "post-personal-fail");
      }
    }
  } else {
    await supabase
      .from("posts")
      .update({ status: "failed", error: "LinkedIn not connected" })
      .eq("id", personalRow.id);
    if (profile.notify_post_failed !== false) {
      await notify("LinkedIn not connected 🔌", "Reconnect from Settings so we can publish tomorrow.", "/settings", "linkedin-missing");
    }
  }

  return { brand: brandRow, personal: personalRow };
}

export const runForCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { preview?: boolean } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    return runDailyForUser({
      userId: context.userId,
      supabase: context.supabase,
      preview: data.preview,
    });
  });
