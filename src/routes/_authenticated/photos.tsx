import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/photos")({
  head: () => ({
    meta: [
      { title: "Photos — GrowNowNow" },
      { name: "description", content: "Upload and manage the headshots and product photos GrowNowNow attaches to your daily LinkedIn posts." },
      { property: "og:title", content: "Photos — GrowNowNow" },
      { property: "og:description", content: "Upload and manage the images used in your daily LinkedIn posts." },
      { property: "og:url", content: "https://autopost.grownownow.com/photos" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://autopost.grownownow.com/photos" }],
  }),
  component: Photos,
});

const MAX = 5 * 1024 * 1024;

function Photos() {
  const { data: photos, refetch } = useQuery({
    queryKey: ["photos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("photos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      if (!photos) return;
      const next: Record<string, string> = {};
      for (const p of photos) {
        const { data } = await supabase.storage.from("photos").createSignedUrl(p.file_path, 60 * 60);
        if (data) next[p.id] = data.signedUrl;
      }
      setUrls(next);
    })();
  }, [photos]);

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      for (const f of Array.from(files)) {
        if (f.size > MAX) throw new Error(`${f.name} is larger than 5MB`);
        if (!["image/jpeg", "image/png"].includes(f.type)) throw new Error(`${f.name} must be JPG or PNG`);
        const path = `${user.id}/${crypto.randomUUID()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("photos").upload(path, f);
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("photos").insert({ user_id: user.id, file_path: path });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => { toast.success("Uploaded"); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (p: { id: string; file_path: string }) => {
      await supabase.storage.from("photos").remove([p.file_path]);
      await supabase.from("photos").delete().eq("id", p.id);
    },
    onSuccess: () => refetch(),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">Photos</h1>
        <p className="mt-1 text-muted-foreground">JPG/PNG, max 5MB. We rotate through these on your personal posts.</p>
      </div>

      <label className="flex cursor-pointer items-center gap-2 self-start rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">
        <Upload className="h-4 w-4" />
        Upload photos
        <input type="file" accept="image/jpeg,image/png" multiple className="hidden"
          onChange={(e) => e.target.files && upload.mutate(e.target.files)} />
      </label>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {photos?.map((p) => (
          <div key={p.id} className="group relative overflow-hidden rounded-xl border bg-card">
            {urls[p.id] ? (
              <img src={urls[p.id]} alt="" className="aspect-square w-full object-cover" />
            ) : <div className="aspect-square bg-muted" />}
            <Button size="icon" variant="destructive" aria-label="Delete photo" className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100"
              onClick={() => del.mutate({ id: p.id, file_path: p.file_path })}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {!photos?.length && (
          <div className="col-span-full rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
            No photos yet. Upload a few headshots, action shots, or product photos.
          </div>
        )}
      </div>
    </div>
  );
}
