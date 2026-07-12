import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getLinkedInAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret)
      throw new Error(
        "LinkedIn is not configured yet. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in Settings → Secrets.",
      );

    const normalizeOrigin = (value?: string) => {
      if (!value) return "";
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "";
      } catch {
        return "";
      }
    };
    const isTemporaryPreviewOrigin = (origin: string) => {
      try {
        const host = new URL(origin).hostname;
        return host.endsWith(".lovableproject.com") || host.startsWith("id-preview--") || host === "localhost";
      } catch {
        return true;
      }
    };

    const envOrigin = normalizeOrigin(process.env.PUBLIC_APP_URL ?? process.env.APP_URL);
    const requestedOrigin = normalizeOrigin(data?.origin);
    const origin = requestedOrigin && !isTemporaryPreviewOrigin(requestedOrigin) ? requestedOrigin : envOrigin;
    if (!origin)
      throw new Error(
        "Set PUBLIC_APP_URL to your app's public URL so LinkedIn can redirect back.",
      );

    const { createLinkedInOAuthState } = await import("@/lib/linkedin-oauth-state.server");
    const redirect = `${origin}/auth/linkedin/callback`;
    const state = createLinkedInOAuthState(context.userId, clientSecret);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirect,
      scope: "w_member_social",
      state,
    });
    return { url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`, redirect };
  });


export async function exchangeLinkedInCode(code: string, redirectUri: string) {
  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
  const r = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!r.ok) throw new Error(`LinkedIn token exchange failed: ${await r.text()}`);
  return r.json() as Promise<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    id_token?: string;
  }>;
}

export async function fetchLinkedInMember(accessToken: string) {
  const r = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error("Could not fetch LinkedIn member info");
  const j = await r.json();
  return { sub: j.sub as string, name: j.name as string };
}

// Upload an image to LinkedIn and return the asset URN.
async function uploadImageToLinkedIn(
  accessToken: string,
  memberUrn: string,
  imageBuffer: ArrayBuffer,
): Promise<string> {
  // Step 1: Register the upload
  const registerRes = await fetch(
    "https://api.linkedin.com/v2/assets?action=registerUpload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: `urn:li:person:${memberUrn}`,
          serviceRelationships: [
            {
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            },
          ],
        },
      }),
    },
  );

  if (!registerRes.ok)
    throw new Error(`LinkedIn register upload failed: ${await registerRes.text()}`);

  const registerJson = await registerRes.json();
  const uploadUrl =
    registerJson.value?.uploadMechanism?.[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ]?.uploadUrl;
  const assetUrn = registerJson.value?.asset;

  if (!uploadUrl || !assetUrn)
    throw new Error("LinkedIn did not return upload URL or asset URN");

  // Step 2: Upload the binary
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "image/jpeg",
    },
    body: imageBuffer,
  });

  if (!uploadRes.ok)
    throw new Error(`LinkedIn image upload failed: ${uploadRes.status}`);

  return assetUrn;
}

// Publish a text-only post to LinkedIn personal profile.
export async function publishToLinkedIn(
  accessToken: string,
  memberUrn: string,
  text: string,
) {
  const r = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:person:${memberUrn}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  if (!r.ok) throw new Error(`LinkedIn publish failed: ${r.status} ${await r.text()}`);
  const id = r.headers.get("x-restli-id");
  return { urn: id ?? "" };
}

// Publish a post with an image to LinkedIn personal profile.
export async function publishImageToLinkedIn(
  accessToken: string,
  memberUrn: string,
  text: string,
  imageBuffer: ArrayBuffer,
) {
  const assetUrn = await uploadImageToLinkedIn(accessToken, memberUrn, imageBuffer);

  const r = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:person:${memberUrn}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "IMAGE",
          media: [
            {
              status: "READY",
              media: assetUrn,
            },
          ],
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });

  if (!r.ok)
    throw new Error(`LinkedIn image post failed: ${r.status} ${await r.text()}`);
  const id = r.headers.get("x-restli-id");
  return { urn: id ?? "" };
}
