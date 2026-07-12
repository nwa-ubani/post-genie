import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getLinkedInAuthUrl } from "@/lib/linkedin.functions";
import { PushNotificationsCard } from "@/components/PushNotificationsCard";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — GrowNowNow" },
      { name: "description", content: "Edit your brief, tone, posting schedule and reconnect LinkedIn for GrowNowNow's daily posting automation." },
      { property: "og:title", content: "Settings — GrowNowNow" },
      { property: "og:description", content: "Edit your brief, tone, posting schedule and reconnect LinkedIn." },
      { property: "og:url", content: "https://autopost.grownownow.com/settings" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://autopost.grownownow.com/settings" }],
  }),
  component: Settings,
});

function Settings() {
  const getAuthUrl = useServerFn(getLinkedInAuthUrl);
  const { data: profile, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").single();
      if (error) throw error;
      return data;
    },
  });
  const { data: tokens } = useQuery({
    queryKey: ["linkedin_tokens"],
    queryFn: async () => (await supabase.from("linkedin_tokens").select("*").maybeSingle()).data,
  });

  const [form, setForm] = useState<Record<string, any>>({});
  useEffect(() => { if (profile) setForm(profile); }, [profile]);

  const normalizeLinkedInProfile = (value: string) => {
    const cleaned = value.trim();
    if (!cleaned) return null;
    if (/^https?:\/\//i.test(cleaned)) return cleaned;
    if (/^linkedin\.com\//i.test(cleaned)) return `https://${cleaned}`;
    if (/^\/in\//i.test(cleaned)) return `https://www.linkedin.com${cleaned}`;
    return `https://www.linkedin.com/in/${cleaned.replace(/^@/, "")}`;
  };

  const save = useMutation({
    mutationFn: async () => {
      const { user_id, created_at, updated_at, onboarding_complete, ...patch } = form;
      const cleanedPatch = {
        ...patch,
        linkedin_personal_url: normalizeLinkedInProfile(patch.linkedin_personal_url ?? ""),
      };
      const { error } = await supabase.from("profiles").update(cleanedPatch as any).eq("user_id", profile!.user_id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const connectLinkedIn = async () => {
    try {
      const { url } = await getAuthUrl({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "LinkedIn not configured");
    }
  };

  const disconnectLinkedIn = async () => {
    await supabase.from("linkedin_tokens").delete().eq("user_id", profile!.user_id);
    toast.success("Disconnected");
  };

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-12">
      <div>
        <h1 className="font-display text-4xl">Settings</h1>
        <p className="mt-1 text-muted-foreground">Edit your brief, schedule, and integrations.</p>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl">LinkedIn</h2>
        <div className="space-y-1.5">
          <Label>Personal LinkedIn profile</Label>
          <Input
            value={form.linkedin_personal_url ?? ""}
            onChange={(e) => setForm({ ...form, linkedin_personal_url: e.target.value })}
            placeholder="https://www.linkedin.com/in/your-name"
          />
          <p className="text-xs text-muted-foreground">
            Full link is best, but you can also type just your LinkedIn username and we'll turn it into a profile link.
          </p>
        </div>
        {tokens ? (
          <div className="flex items-center justify-between rounded-xl border bg-card p-4">
            <div>
              <p className="text-sm font-medium">{tokens.linkedin_name ?? "Connected"}</p>
              <p className="text-xs text-muted-foreground">Personal profile posting enabled</p>
            </div>
            <Button variant="outline" onClick={disconnectLinkedIn}>Disconnect</Button>
          </div>
        ) : (
          <Button onClick={connectLinkedIn}>Connect LinkedIn</Button>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">Brief</h2>
        {[
          ["name", "Name"], ["role", "Role"], ["company", "Company"], ["industry", "Industry"],
        ].map(([k, label]) => (
          <div key={k} className="space-y-1.5">
            <Label>{label}</Label>
            <Input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label>Company description</Label>
          <Textarea rows={4} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Tone</Label>
          <Input value={form.tone ?? ""} onChange={(e) => setForm({ ...form, tone: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Admired brands (comma-separated)</Label>
          <Input value={(form.admired_brands ?? []).join(", ")} onChange={(e) => setForm({ ...form, admired_brands: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Content topics (comma-separated)</Label>
          <Input value={(form.content_topics ?? []).join(", ")} onChange={(e) => setForm({ ...form, content_topics: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">Voice & style</h2>
        <div className="space-y-1.5">
          <Label>Extra instructions for the AI</Label>
          <Textarea
            rows={4}
            value={form.custom_instructions ?? ""}
            onChange={(e) => setForm({ ...form, custom_instructions: e.target.value })}
            placeholder="e.g. Never use emojis. Always end with a question. Write in lowercase."
          />
          <p className="text-xs text-muted-foreground">Highest priority — overrides the defaults when they conflict.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Your writing samples (one per line, up to 5)</Label>
          <Textarea
            rows={8}
            value={(form.writing_samples ?? []).join("\n---\n")}
            onChange={(e) => setForm({ ...form, writing_samples: e.target.value.split(/\n---\n/).map((s: string) => s.trim()).filter(Boolean).slice(0, 5) })}
            placeholder={"Paste one of your best posts…\n---\nAnother post…"}
          />
          <p className="text-xs text-muted-foreground">Separate multiple samples with a line containing only ---</p>
        </div>
        <div className="space-y-1.5">
          <Label>Role-model URLs (comma-separated)</Label>
          <Input
            value={(form.role_model_urls ?? []).join(", ")}
            onChange={(e) => setForm({ ...form, role_model_urls: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 5) })}
            placeholder="https://blog1.com/post, https://blog2.com/post"
          />
          <p className="text-xs text-muted-foreground">Public blog/newsletter pages only. We'll study their voice, not copy content.</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">Schedule</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Posting time</Label>
            <Input
              type="time"
              value={form.posting_time ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setForm({ ...form, posting_time: val });
                if (val && /^\d{2}:\d{2}$/.test(val)) {
                  const now = new Date();
                  const nowMinutes = now.getHours() * 60 + now.getMinutes();
                  const windowStart = Math.floor(nowMinutes / 15) * 15;
                  const windowEnd = windowStart + 15;
                  const [h, m] = val.split(":").map(Number);
                  const picked = h * 60 + m;
                  if (picked >= windowStart && picked < windowEnd) {
                    const nextH = Math.floor(windowEnd / 60) % 24;
                    const nextM = windowEnd % 60;
                    const nextLabel = `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`;
                    toast.warning(
                      `This time is in the current 15-minute window. Your post will go out at the next available run — pick a time after ${nextLabel} if you want it to post tomorrow.`
                    );
                  }
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Input value={form.timezone ?? ""} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Which days should we post?</Label>
          <div className="flex flex-wrap gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, idx) => {
              const days: number[] = form.posting_days ?? [0, 1, 2, 3, 4, 5, 6];
              const active = days.includes(idx);
              return (
                <button
                  type="button"
                  key={label}
                  onClick={() => {
                    const current: number[] = form.posting_days ?? [0, 1, 2, 3, 4, 5, 6];
                    if (active) {
                      if (current.length <= 1) {
                        toast.error("You must post at least one day per week.");
                        return;
                      }
                      setForm({ ...form, posting_days: current.filter((d) => d !== idx).sort() });
                    } else {
                      setForm({ ...form, posting_days: [...current, idx].sort() });
                    }
                  }}
                  className={`h-10 w-14 rounded-md border text-sm font-medium transition ${
                    active ? "bg-foreground text-background border-foreground" : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Make.com webhook URL <span className="text-xs text-muted-foreground">(for company-page handoff)</span></Label>
          <Input value={form.make_webhook_url ?? ""} onChange={(e) => setForm({ ...form, make_webhook_url: e.target.value })} placeholder="https://hook.make.com/…" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Notifications</h2>
        <PushNotificationsCard />
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-sm font-medium">What to notify me about</p>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>When today's post publishes</span>
            <input
              type="checkbox"
              checked={form.notify_post_published !== false}
              onChange={(e) => setForm({ ...form, notify_post_published: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>When a run fails</span>
            <input
              type="checkbox"
              checked={form.notify_post_failed !== false}
              onChange={(e) => setForm({ ...form, notify_post_failed: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>When my LinkedIn connection is about to expire</span>
            <input
              type="checkbox"
              checked={form.notify_token_expiring !== false}
              onChange={(e) => setForm({ ...form, notify_token_expiring: e.target.checked })}
            />
          </label>
        </div>
      </section>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>Save changes</Button>
    </div>
  );
}
