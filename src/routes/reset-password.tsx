import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — Auto-Post" },
      { name: "description", content: "Choose a new password for your Auto-Post account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Reset password — Auto-Post" },
      { property: "og:url", content: "https://autopost.grownownow.com/reset-password" },
    ],
    links: [{ rel: "canonical", href: "https://autopost.grownownow.com/reset-password" }],
  }),
  component: ResetPasswordPage,
});

const PASSWORD_MIN = 8;
function validatePassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (!/[A-Z]/.test(pw)) return "Include at least one uppercase letter.";
  if (!/[a-z]/.test(pw)) return "Include at least one lowercase letter.";
  if (!/[0-9]/.test(pw)) return "Include at least one number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Include at least one symbol (e.g. !@#$).";
  return null;
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when it detects the recovery hash on load,
    // and creates a temporary session that only allows updateUser.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Fallback: if a session already exists (link just processed), allow reset.
    supabase.auth.getSession().then(({ data }) => {
      const isRecovery = typeof window !== "undefined" && window.location.hash.includes("type=recovery");
      if (data.session || isRecovery) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validatePassword(password);
    if (err) { toast.error(err); return; }
    if (password !== confirm) { toast.error("Passwords don't match."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/dashboard" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not update password";
      if (/pwned|leaked|weak|compromis/i.test(msg)) {
        toast.error("That password has appeared in a known data breach. Please pick a different one.");
      } else {
        toast.error(msg);
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-display text-xl">Auto-Post</Link>
        <h1 className="mt-10 font-display text-3xl">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a strong password you haven't used before.
        </p>

        {!ready ? (
          <div className="mt-8 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">This link may have expired.</p>
            <p className="mt-1">
              Open the most recent reset email, or{" "}
              <Link to="/auth" className="underline underline-offset-2">request a new link</Link>.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={PASSWORD_MIN}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                At least 8 chars with uppercase, lowercase, number, and symbol.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                required
                minLength={PASSWORD_MIN}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
