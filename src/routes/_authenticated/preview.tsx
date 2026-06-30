import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runForCurrentUser } from "@/lib/posts.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/preview")({
  component: Preview,
});

function Preview() {
  const runNow = useServerFn(runForCurrentUser);

  const { data: posts, refetch } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(2);
      if (error) throw error;
      return data ?? [];
    },
  });

  const run = useMutation({
    mutationFn: () => runNow({ data: { preview: true } }),
    onSuccess: () => { toast.success("Preview generated"); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="font-display text-4xl">Your first day, live.</h1>
        <p className="mt-2 text-muted-foreground">We'll research your industry and draft both posts. Nothing publishes from this screen.</p>
      </div>

      <Button onClick={() => run.mutate()} disabled={run.isPending} size="lg">
        {run.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate preview</>}
      </Button>

      <div className="space-y-4">
        {posts?.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="font-normal">Post {p.post_type === "brand" ? "A · Brand" : "B · Personal"}</Badge>
              {p.keyword_hook && <span>Hook: {p.keyword_hook}</span>}
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{p.content}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Link to="/dashboard" className="text-sm underline">Continue to dashboard →</Link>
      </div>
    </div>
  );
}
