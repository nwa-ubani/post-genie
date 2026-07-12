import { createServerFn } from "@tanstack/react-start";
import { exchangeLinkedInCode } from "@/lib/linkedin.functions";

export const saveLinkedInToken = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; state: string; redirectUri: string }) => d)
  .handler(async ({ data }) => {
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientSecret) throw new Error("LinkedIn is not configured yet.");

    const { verifyLinkedInOAuthState } = await import("@/lib/linkedin-oauth-state.server");
    const { userId } = verifyLinkedInOAuthState(data.state, clientSecret);
    const token = await exchangeLinkedInCode(data.code, data.redirectUri);
    const profile = token.id_token
      ? JSON.parse(Buffer.from(token.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as { sub?: string; name?: string }
      : null;
    if (!profile?.sub) {
      throw new Error("LinkedIn connected, but did not return the profile ID needed for posting. Make sure Sign In with LinkedIn is enabled in your LinkedIn app.");
    }
    const expires_at = new Date(Date.now() + token.expires_in * 1000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("linkedin_tokens").upsert({
      user_id: userId,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at,
      linkedin_member_urn: profile.sub,
      linkedin_name: profile.name ?? "Connected",
    });
    if (error) throw error;
    return { ok: true };
  });
