import { createServerFn } from "@tanstack/react-start";
import { exchangeLinkedInCode, fetchLinkedInMember } from "@/lib/linkedin.functions";

export const saveLinkedInToken = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; state: string; redirectUri: string }) => d)
  .handler(async ({ data }) => {
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientSecret) throw new Error("LinkedIn is not configured yet.");

    const { verifyLinkedInOAuthState } = await import("@/lib/linkedin-oauth-state.server");
    const { userId } = verifyLinkedInOAuthState(data.state, clientSecret);
    const token = await exchangeLinkedInCode(data.code, data.redirectUri);
    const member = await fetchLinkedInMember(token.access_token);
    const expires_at = new Date(Date.now() + token.expires_in * 1000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("linkedin_tokens").upsert({
      user_id: userId,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at,
      linkedin_member_urn: member.sub,
      linkedin_name: member.name,
    });
    if (error) throw error;
    return { ok: true };
  });
