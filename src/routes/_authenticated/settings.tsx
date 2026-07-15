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

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  const normalizeTime = (v: string): string | null => {
    const s = v.trim();
    if (!s) return null;
    const m = s.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (isNaN(h) || isNaN(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };

  // Derive posting_schedule from form, falling back to legacy posting_days/posting_times
  const scheduleFromForm = (): Record<string, string[]> => {
    const raw = form.posting_schedule as Record<string, string[]> | null | undefined;
    if (raw && typeof raw === "object" && Object.keys(raw).length) return raw;
    const legacyDays: number[] = form.posting_days ?? [0, 1, 2, 3, 4, 5, 6];
    const legacyTimes: string[] = (form.posting_times?.length ? form.posting_times : (form.posting_time ? [form.posting_time] : [])) as string[];
    const out: Record<string, string[]> = {};
    for (const d of legacyDays) out[String(d)] = [...legacyTimes];
    return out;
  };

  const save = useMutation({
    mutationFn: async () => {
      const { user_id, created_at, updated_at, onboarding_complete, ...patch } = form;

      const schedule = scheduleFromForm();
      const cleanedSchedule: Record<string, string[]> = {};
      for (const [day, times] of Object.entries(schedule)) {
        const norm = (times ?? [])
          .map(normalizeTime)
          .filter((t): t is string => !!t);
        const unique = Array.from(new Set(norm)).sort();
        if (unique.length) cleanedSchedule[day] = unique;
      }
      if (!Object.keys(cleanedSchedule).length) {
        throw new Error("Add at least one day with at least one posting time.");
      }

      // Keep legacy columns roughly in sync so old code paths still work
      const days = Object.keys(cleanedSchedule).map(Number).sort((a, b) => a - b);
      const allTimes = Array.from(new Set(Object.values(cleanedSchedule).flat())).sort();

      const cleanedPatch = {
        ...patch,
        posting_schedule: cleanedSchedule,
        posting_days: days,
        posting_times: allTimes,
        posting_time: null,
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

      <section className="space-y-5">
        <h2 className="font-display text-xl">Schedule</h2>

        {(() => {
          const days: number[] = form.posting_days ?? [0, 1, 2, 3, 4, 5, 6];
          const rawTimes: string[] = (form.posting_times?.length ? form.posting_times : (form.posting_time ? [form.posting_time] : [])) as string[];
          const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
          const seen = new Map<string, number>();
          const dupIdx = new Set<number>();
          rawTimes.forEach((t, i) => {
            if (!timeRegex.test(t)) return;
            if (seen.has(t)) { dupIdx.add(i); dupIdx.add(seen.get(t)!); }
            else seen.set(t, i);
          });

          const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const validTimes = Array.from(new Set(rawTimes.filter((t) => timeRegex.test(t)))).sort();

          // Next run preview (uses the user's browser TZ for display; server uses profile TZ)
          let nextRunLabel: string | null = null;
          if (days.length && validTimes.length) {
            const now = new Date();
            for (let offset = 0; offset < 8 && !nextRunLabel; offset++) {
              const d = new Date(now);
              d.setDate(now.getDate() + offset);
              const weekday = d.getDay();
              if (!days.includes(weekday)) continue;
              for (const t of validTimes) {
                const [h, m] = t.split(":").map(Number);
                const candidate = new Date(d);
                candidate.setHours(h, m, 0, 0);
                if (candidate.getTime() > now.getTime()) {
                  nextRunLabel = `${dayNames[weekday]} ${candidate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${candidate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
                  break;
                }
              }
            }
          }

          return (
            <>
              <div className="space-y-2">
                <Label>Which days should we post?</Label>
                <div className="flex flex-wrap gap-2">
                  {dayNames.map((label, idx) => {
                    const active = days.includes(idx);
                    return (
                      <button
                        type="button"
                        key={label}
                        onClick={() => {
                          if (active) {
                            if (days.length <= 1) {
                              toast.message("You need at least one posting day.");
                              return;
                            }
                            setForm({ ...form, posting_days: days.filter((d) => d !== idx).sort() });
                          } else {
                            setForm({ ...form, posting_days: [...days, idx].sort() });
                          }
                        }}
                        className={`h-10 min-w-16 rounded-full border px-4 text-sm font-medium transition ${
                          active
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {days.length === 0 && (
                  <p className="text-xs text-destructive">You need at least one posting day.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Posting times</Label>
                <p className="text-xs text-muted-foreground">Each time triggers a fresh, independent post. Add as many as you like.</p>
                <div className="space-y-2">
                  {rawTimes.map((t: string, i: number) => {
                    const valid = timeRegex.test(t);
                    const duplicate = dupIdx.has(i);
                    const active = valid && !duplicate;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={t}
                            onChange={(e) => {
                              const val = e.target.value;
                              const next = [...rawTimes];
                              next[i] = val;
                              setForm({ ...form, posting_times: next, posting_time: null });
                              if (val && timeRegex.test(val)) {
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
                                    `This time is in the current 15-minute window. Pick a time after ${nextLabel} to post tomorrow.`
                                  );
                                }
                              }
                            }}
                            className={`max-w-40 ${
                              duplicate || (t && !valid)
                                ? "border-destructive bg-destructive/5"
                                : active
                                  ? "border-primary bg-primary/5 font-medium text-foreground"
                                  : ""
                            }`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const next = rawTimes.filter((_, idx) => idx !== i);
                              setForm({ ...form, posting_times: next, posting_time: null });
                            }}
                            aria-label="Remove time slot"
                          >
                            ×
                          </Button>
                        </div>
                        {t && !valid && (
                          <p className="text-xs text-destructive">Enter a valid time (HH:MM, 24-hour).</p>
                        )}
                        {duplicate && valid && (
                          <p className="text-xs text-destructive">Duplicate time — each slot must be unique.</p>
                        )}
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setForm({ ...form, posting_times: [...rawTimes, "09:00"], posting_time: null });
                    }}
                  >
                    + Add time
                  </Button>
                  {rawTimes.length === 0 && (
                    <p className="text-xs text-destructive">Add at least one posting time.</p>
                  )}
                </div>
              </div>

              {nextRunLabel && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Next run</p>
                  <p className="text-sm font-medium">{nextRunLabel}</p>
                </div>
              )}
            </>
          );
        })()}

        <div className="space-y-1.5">
          <Label>Timezone</Label>
          <Input value={form.timezone ?? ""} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
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
