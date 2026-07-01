import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { runForCurrentUser } from "@/lib/posts.functions";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — GrowNowNow" },
      { name: "description", content: "See today's LinkedIn posts, run automation on demand, and review recent activity in your GrowNowNow dashboard." },
      { property: "og:title", content: "Dashboard — GrowNowNow" },
      { property: "og:description", content: "See today's LinkedIn posts and run automation on demand." },
      { property: "og:url", content: "https://autopost.grownownow.com/dashboard" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://autopost.grownownow.com/dashboard" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const runNow = useServerFn(runForCurrentUser);

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").single();
      if (error) throw error;
      return data;
    },
  });

  const { data: posts } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tokens } = useQuery({
    queryKey: ["linkedin_tokens"],
    queryFn: async () => {
      const { data } = await supabase.from("linkedin_tokens").select("linkedin_name, expires_at").maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!isLoading && profile && !profile.onboarding_complete) navigate({ to: "/onboarding" });
  }, [isLoading, profile, navigate]);

  const toggleActive = useMutation({
    mutationFn: async (active: boolean) => {
      const { error } = await supabase.from("profiles").update({ active }).eq("user_id", profile!.user_id);
      if (error) throw error;
    },
    onSuccess: () => { refetch(); toast.success("Schedule updated"); },
  });

  const runMut = useMutation({
    mutationFn: () => runNow({ data: {} }),
    onSuccess: () => { toast.success("Run complete"); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!profile) return null;

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl">Good to see you, {profile.name}.</h1>
          <p className="mt-1 text-muted-foreground">
            Posting daily at <span className="font-medium text-foreground">{profile.posting_time}</span> · {profile.timezone}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-full border bg-card px-4 py-2">
          <span className="text-sm">{profile.active ? "Active" : "Paused"}</span>
          <Switch checked={profile.active} onCheckedChange={(v) => toggleActive.mutate(v)} aria-label="Toggle automation active" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">LinkedIn</p>
          {tokens ? (
            <>
              <p className="mt-2 font-display text-xl">{tokens.linkedin_name ?? "Connected"}</p>
              <p className="text-xs text-muted-foreground">Personal profile</p>
            </>
          ) : (
            <Link to="/settings" className="mt-2 inline-flex items-center gap-1 text-sm text-accent">
              Connect LinkedIn <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Make.com</p>
          <p className="mt-2 font-display text-xl">{profile.make_webhook_url ? "Webhook set" : "Not set"}</p>
          <p className="text-xs text-muted-foreground" title="Brand posts are POSTed to your Make.com webhook so you can route them to a company page.">Company-page handoff</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total posts</p>
          <p className="mt-2 font-display text-xl">{posts?.length ?? 0}</p>
          <p className="text-xs text-muted-foreground">All time</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Recent posts</h2>
        <Button onClick={() => runMut.mutate()} disabled={runMut.isPending}>
          {runMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run now"}
        </Button>
      </div>

      <div className="space-y-3">
        {!posts?.length && (
          <div className="rounded-2xl border border-dashed bg-card/40 p-10 text-center text-muted-foreground">
            No posts yet. Hit <span className="font-medium text-foreground">Run now</span> to generate today's pair.
          </div>
        )}
        {posts?.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-normal">{p.post_type}</Badge>
                <span>{new Date(p.created_at).toLocaleString()}</span>
                {p.keyword_hook && <span>· {p.keyword_hook}</span>}
              </div>
              <Badge variant={p.status === "published" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>
                {p.status}
              </Badge>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{p.content}</p>
            {p.error && <p className="mt-2 text-xs text-destructive">{p.error}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
