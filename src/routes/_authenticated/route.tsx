import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="font-display text-lg">GrowNowNow</Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>Dashboard</Link>
            <Link to="/photos" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>Photos</Link>
            <Link to="/settings" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>Settings</Link>
            <span className="hidden text-xs text-muted-foreground sm:inline">{user?.email}</span>
            <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground">Sign out</button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
