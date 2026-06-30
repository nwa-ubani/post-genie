import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exchangeLinkedInCode, fetchLinkedInMember } from "@/lib/linkedin.functions";

export const saveLinkedInToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; state: string; redirectUri: string }) => d)
  .handler(async ({ data, context }) => {
    if (!data.state.startsWith(context.userId + ".")) throw new Error("Invalid state");
    const token = await exchangeLinkedInCode(data.code, data.redirectUri);
    const member = await fetchLinkedInMember(token.access_token);
    const expires_at = new Date(Date.now() + token.expires_in * 1000).toISOString();
    const { error } = await context.supabase.from("linkedin_tokens").upsert({
      user_id: context.userId,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at,
      linkedin_member_urn: member.sub,
      linkedin_name: member.name,
    });
    if (error) throw error;
    return { ok: true };
  });
