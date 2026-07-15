import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/photos")({
  head: () => ({
    meta: [
      { title: "Media — Auto-Post" },
      { name: "description", content: "Upload and manage the images and videos Auto-Post attaches to your daily LinkedIn posts." },
      { property: "og:title", content: "Media — Auto-Post" },
      { property: "og:description", content: "Upload and manage the media used in your daily LinkedIn posts." },
      { property: "og:url", content: "https://autopost.grownownow.com/photos" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://autopost.grownownow.com/photos" }],
  }),
  component: MediaPage,
});

type PhotoRow = {
  id: string;
  user_id: string;
  file_path: string;
  thumb_path: string | null;
  media_type: "image" | "video" | null;
  content_type: string | null;
  last_used_at: string | null;
  created_at: string;
};

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const HEIC_TYPES = ["image/heic", "image/heif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

const isHeicByName = (name: string) => /\.(heic|heif)$/i.test(name);
const isHeicFile = (f: File) => HEIC_TYPES.includes(f.type.toLowerCase()) || isHeicByName(f.name);

async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const blob = (await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 })) as Blob | Blob[];
  const out = Array.isArray(blob) ? blob[0] : blob;
  const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
  return new File([out], newName, { type: "image/jpeg" });
}

async function makeImageThumbnail(file: File | Blob, maxWidth = 400, quality = 0.75): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, maxWidth / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("thumb encode failed"))), "image/jpeg", quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function makeVideoPoster(file: File, maxWidth = 400, quality = 0.75): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise<void>((res, rej) => {
      video.onloadeddata = () => res();
      video.onerror = () => rej(new Error("video load failed"));
    });
    try { video.currentTime = Math.min(0.1, (video.duration || 1) / 2); } catch { /* ignore */ }
    await new Promise<void>((res) => {
      const done = () => res();
      video.onseeked = done;
      setTimeout(done, 800);
    });
    const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
    const w = Math.round((video.videoWidth || maxWidth) * scale);
    const h = Math.round((video.videoHeight || maxWidth) * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("poster encode failed"))), "image/jpeg", quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function MediaPage() {
  const qc = useQueryClient();
  const { data: photos } = useQuery<PhotoRow[]>({
    queryKey: ["photos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("photos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PhotoRow[];
    },
  });

  const [urls, setUrls] = useState<Record<string, { thumb: string; full: string }>>({});
  useEffect(() => {
    (async () => {
      if (!photos) return;
      const next: Record<string, { thumb: string; full: string }> = {};
      await Promise.all(
        photos.map(async (p) => {
          const fullReq = supabase.storage.from("photos").createSignedUrl(p.file_path, 60 * 60);
          const thumbReq = p.thumb_path
            ? supabase.storage.from("photos").createSignedUrl(p.thumb_path, 60 * 60)
            : Promise.resolve(null);
          const [fullRes, thumbRes] = await Promise.all([fullReq, thumbReq]);
          const full = fullRes.data?.signedUrl ?? "";
          const thumb = (thumbRes && thumbRes.data?.signedUrl) || full;
          next[p.id] = { thumb, full };
        }),
      );
      setUrls(next);
    })();
  }, [photos]);

  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const dragCounter = useRef(0);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not signed in"); return; }

    let ok = 0;
    let fail = 0;
    setProgress({ done: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      const raw = files[i];
      try {
        let f = raw;
        const heic = isHeicFile(raw);
        if (heic) {
          try {
            f = await convertHeicToJpeg(raw);
          } catch {
            toast.error(`${raw.name} could not be converted — please upload it as JPG or PNG`);
            fail++;
            setProgress({ done: i + 1, total: files.length });
            continue;
          }
        }

        const isImage = IMAGE_TYPES.includes(f.type);
        const isVideo = VIDEO_TYPES.includes(f.type);
        if (!isImage && !isVideo) {
          toast.error(`${raw.name}: unsupported file type`);
          fail++;
          setProgress({ done: i + 1, total: files.length });
          continue;
        }
        const limit = isImage ? MAX_IMAGE : MAX_VIDEO;
        if (f.size > limit) {
          toast.error(`${raw.name} is larger than ${isImage ? "5MB" : "100MB"}`);
          fail++;
          setProgress({ done: i + 1, total: files.length });
          continue;
        }

        const uid = crypto.randomUUID();
        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${uid}-${safeName}`;

        // Build thumbnail in parallel with the main upload
        const thumbPath = `${user.id}/thumbs/${uid}.jpg`;
        const thumbPromise = (async () => {
          try {
            const blob = isVideo ? await makeVideoPoster(f) : await makeImageThumbnail(f);
            const { error } = await supabase.storage.from("photos").upload(thumbPath, blob, { contentType: "image/jpeg" });
            return error ? null : thumbPath;
          } catch {
            return null;
          }
        })();

        const { error: upErr } = await supabase.storage.from("photos").upload(path, f, { contentType: f.type });
        if (upErr) throw upErr;
        const finalThumb = await thumbPromise;

        const { error: insErr } = await supabase.from("photos").insert({
          user_id: user.id,
          file_path: path,
          thumb_path: finalThumb,
          media_type: isVideo ? "video" : "image",
          content_type: f.type,
        } as never);
        if (insErr) throw insErr;
        ok++;
      } catch (e) {
        fail++;
        toast.error(`${raw.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      } finally {
        setProgress({ done: i + 1, total: files.length });
      }
    }

    setProgress(null);
    if (fail === 0) toast.success(`${ok} file${ok === 1 ? "" : "s"} uploaded.`);
    else toast.success(`${ok} uploaded, ${fail} failed.`);
    qc.invalidateQueries({ queryKey: ["photos"] });
  }, [qc]);

  // Delete flow: confirm-tap, optimistic remove, undo toast
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearConfirm = () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = null;
    setConfirmId(null);
  };

  const performDelete = async (p: PhotoRow) => {
    const previous = qc.getQueryData<PhotoRow[]>(["photos"]) ?? [];
    // Optimistic remove
    qc.setQueryData<PhotoRow[]>(["photos"], previous.filter((x) => x.id !== p.id));

    let undone = false;
    const commit = async () => {
      if (undone) return;
      try {
        const paths = [p.file_path, ...(p.thumb_path ? [p.thumb_path] : [])];
        await supabase.storage.from("photos").remove(paths);
        const { error } = await supabase.from("photos").delete().eq("id", p.id);
        if (error) throw error;
      } catch {
        qc.setQueryData<PhotoRow[]>(["photos"], previous);
        toast.error("Delete failed, try again.");
      }
    };

    toast("Deleted", {
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          qc.setQueryData<PhotoRow[]>(["photos"], previous);
        },
      },
      duration: 5000,
    });
    setTimeout(commit, 5000);
  };

  const onTrashClick = (p: PhotoRow) => {
    if (confirmId === p.id) {
      clearConfirm();
      performDelete(p);
      return;
    }
    setConfirmId(p.id);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmId(null), 3000);
  };

  // Preview modal
  const [preview, setPreview] = useState<PhotoRow | null>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">Media</h1>
        <p className="mt-1 text-muted-foreground">Images (JPG, PNG, WebP, HEIC — up to 5MB) or videos (MP4, MOV, WebM — up to 100MB). We rotate through these on your personal posts.</p>
      </div>

      <div
        onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current <= 0) setDragActive(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
          dragActive ? "border-primary bg-primary/5" : "border-border bg-muted/20"
        }`}
      >
        {dragActive ? (
          <p className="font-display text-xl">Drop your files here</p>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">Drag & drop files here, or</p>
            <label className="flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">
              <Upload className="h-4 w-4" />
              Upload media
              <input
                type="file"
                accept={[...IMAGE_TYPES, ...HEIC_TYPES, ...VIDEO_TYPES, ".heic", ".heif"].join(",")}
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </label>
            {progress && (
              <p className="text-xs text-muted-foreground">Uploading {progress.done} of {progress.total}…</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {photos?.map((p) => {
          const isVideo = p.media_type === "video";
          const u = urls[p.id];
          const confirming = confirmId === p.id;
          return (
            <div key={p.id} className="group relative overflow-hidden rounded-xl border bg-card">
              <button
                type="button"
                className="block w-full"
                onClick={() => setPreview(p)}
                aria-label="Preview media"
              >
                {u?.thumb ? (
                  <img
                    src={u.thumb}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full animate-pulse bg-muted" />
                )}
                {isVideo && (
                  <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                    Video
                  </span>
                )}
              </button>
              <Button
                size={confirming ? "sm" : "icon"}
                variant="destructive"
                aria-label={confirming ? "Tap again to confirm" : "Delete media"}
                className={`absolute right-2 top-2 transition ${
                  confirming ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                }`}
                onClick={(e) => { e.stopPropagation(); onTrashClick(p); }}
              >
                {confirming ? "Tap again to confirm" : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        })}
        {!photos?.length && !progress && (
          <div className="col-span-full rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
            No media yet. Upload a few headshots, action shots, product photos, or short videos.
          </div>
        )}
      </div>

      {preview && urls[preview.id] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            aria-label="Close preview"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setPreview(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <div className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {preview.media_type === "video" ? (
              <video src={urls[preview.id].full} controls autoPlay className="max-h-[85vh] max-w-full rounded-lg" />
            ) : (
              <img src={urls[preview.id].full} alt="" className="max-h-[85vh] max-w-full rounded-lg object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
