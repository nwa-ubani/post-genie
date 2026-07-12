import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PASSWORD_MIN = 8;
function validatePassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (!/[A-Z]/.test(pw)) return "Include at least one uppercase letter.";
  if (!/[a-z]/.test(pw)) return "Include at least one lowercase letter.";
  if (!/[0-9]/.test(pw)) return "Include at least one number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Include at least one symbol (e.g. !@#$).";
  return null;
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — GrowNowNow" },
      { name: "description", content: "Sign in or create your GrowNowNow account to set up daily AI-researched LinkedIn posts on autopilot." },
      { property: "og:title", content: "Sign in — GrowNowNow" },
      { property: "og:description", content: "Sign in or create your GrowNowNow account to set up daily LinkedIn posts on autopilot." },
      { property: "og:url", content: "https://autopost.grownownow.com/auth" },
    ],
    links: [{ rel: "canonical", href: "https://autopost.grownownow.com/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const isChildRoute = Boolean(matchRoute({ to: "/auth/linkedin/callback", fuzzy: true }));
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const passwordError = mode === "signup" && password.length > 0 ? validatePassword(password) : null;

  if (isChildRoute) return <Outlet />;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup") {
      const err = validatePassword(password);
      if (err) { toast.error(err); return; }
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/onboarding` },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created. Let's set you up.");
          navigate({ to: "/onboarding" });
        } else {
          setCheckEmail(true);
          toast.success("Check your email to verify your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Authentication failed";
      if (/pwned|leaked|weak|compromis/i.test(msg)) {
        toast.error("That password has appeared in a known data breach. Please pick a different one.");
      } else {
        toast.error(msg);
      }
    } finally { setLoading(false); }
  };

  const google = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error(result.error.message); setLoading(false); return; }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-display text-xl">GrowNowNow</Link>
        <h1 className="mt-10 font-display text-3xl">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signup" ? "A few quick questions and you're posting daily." : "Pick up where you left off."}
        </p>

        {checkEmail && (
          <div className="mt-6 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-muted-foreground">
              We just sent a verification link to <span className="font-medium text-foreground">{email}</span>.
              Click it to activate your account and continue onboarding.
            </p>
          </div>
        )}

        <Button variant="outline" className="mt-8 w-full" onClick={google} disabled={loading}>
          Continue with Google
        </Button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={mode === "signup" ? PASSWORD_MIN : 6}
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
            {mode === "signup" && (
              <p className={`text-xs ${passwordError ? "text-destructive" : "text-muted-foreground"}`}>
                {passwordError ?? "At least 8 chars with uppercase, lowercase, number, and symbol. Avoid common or breached passwords."}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
