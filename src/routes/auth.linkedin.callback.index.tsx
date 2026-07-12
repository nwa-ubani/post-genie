import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { saveLinkedInToken } from "@/lib/linkedin-callback.functions";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/linkedin/callback/")({
  component: LinkedInCallback,
});

function LinkedInCallback() {
  const navigate = useNavigate();
  const save = useServerFn(saveLinkedInToken);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerError = params.get("error_description") ?? params.get("error");
    if (providerError) { setError(providerError); return; }
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) { setError("Missing code/state"); return; }
    save({ data: { code, state, redirectUri: `${window.location.origin}/auth/linkedin/callback` } })
      .then(() => navigate({ to: "/settings" }))
      .catch((e: Error) => setError(e.message));
  }, [save, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Finishing LinkedIn sign-in…
        </div>
      )}
    </div>
  );
}
