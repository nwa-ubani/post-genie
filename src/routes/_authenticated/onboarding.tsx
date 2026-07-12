import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Plus, Sparkles, X, Linkedin } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { suggestField } from "@/lib/ai-suggest.functions";
import { getLinkedInAuthUrl } from "@/lib/linkedin.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

type Profile = {
  name?: string; role?: string; company?: string; industry?: string;
  description?: string; twitter_handle?: string; linkedin_company_url?: string;
  tone?: string; admired_brands?: string[]; content_topics?: string[];
  posting_time?: string; posting_times?: string[]; timezone?: string;
};

const TONES = ["Authoritative", "Friendly", "Witty", "Bold", "Warm", "Analytical"];

const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "New York (Eastern)" },
  { value: "America/Chicago", label: "Chicago (Central)" },
  { value: "America/Denver", label: "Denver (Mountain)" },
  { value: "America/Los_Angeles", label: "Los Angeles (Pacific)" },
  { value: "America/Toronto", label: "Toronto" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "Europe/London", label: "London (UK)" },
  { value: "Europe/Dublin", label: "Dublin" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Europe/Amsterdam", label: "Amsterdam" },
  { value: "Africa/Lagos", label: "Lagos" },
  { value: "Africa/Johannesburg", label: "Johannesburg" },
  { value: "Africa/Cairo", label: "Cairo" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "Auckland" },
];

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Profile>({});
  const [brandsText, setBrandsText] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [times, setTimes] = useState<string[]>(["09:00"]);
  const [tones, setTones] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const total = 11;
  const suggest = useServerFn(suggestField);
  const getLinkedIn = useServerFn(getLinkedInAuthUrl);

  const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  const { data: existing } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").single()).data,
  });

  useEffect(() => {
    if (existing) {
      setDraft({
        name: existing.name ?? "", role: existing.role ?? "", company: existing.company ?? "",
        industry: existing.industry ?? "", description: existing.description ?? "",
        twitter_handle: existing.twitter_handle ?? "", linkedin_company_url: existing.linkedin_company_url ?? "",
        tone: existing.tone ?? "", admired_brands: existing.admired_brands ?? [],
        content_topics: existing.content_topics ?? [],
        posting_time: existing.posting_time ?? "09:00",
        posting_times: (existing as any).posting_times ?? [existing.posting_time ?? "09:00"],
        timezone: existing.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setBrandsText((existing.admired_brands ?? []).join(", "));
      setTopicsText((existing.content_topics ?? []).join(", "));
      const existingTimes = (existing as any).posting_times as string[] | null;
      setTimes(existingTimes?.length ? existingTimes.map((t) => t.slice(0, 5)) : [existing.posting_time?.slice(0, 5) ?? "09:00"]);
      setTones(existing.tone ? existing.tone.split(",").map((t: string) => t.trim()).filter(Boolean) : []);
    }
  }, [existing]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const toggleTone = (t: string) => {
    setTones((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      if (prev.length >= 3) { toast("Pick up to 3 tones"); return prev; }
      return [...prev, t];
    });
  };

  const askAi = async (field: "role" | "company" | "industry" | "description" | "brands" | "topics" | "tone") => {
    setSuggesting(field);
    try {
      const { suggestion } = await suggest({
        data: {
          field,
          context: {
            name: draft.name, role: draft.role, company: draft.company,
            industry: draft.industry, description: draft.description,
            brands: draft.admired_brands, topics: draft.content_topics, tone: tones.join(", "),
          },
        },
      });
      if (field === "brands") setBrandsText(suggestion);
      else if (field === "topics") setTopicsText(suggestion);
      else if (field === "tone") {
        const picks = suggestion.split(",").map((s) => s.trim()).filter((s) => TONES.includes(s)).slice(0, 3);
        if (picks.length) setTones(picks);
      } else set(field as keyof Profile, suggestion as any);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI suggestion failed");
    } finally { setSuggesting(null); }
  };

  const saveAndNext = async (patch: Partial<Profile> = {}) => {
    setSaving(true);
    try {
      const merged: any = {
        ...draft,
        tone: tones.join(", "),
        admired_brands: splitList(brandsText),
        content_topics: splitList(topicsText),
        posting_time: times[0] ?? "09:00",
        posting_times: times.length ? times : ["09:00"],
        ...patch,
      };
      const { error } = await supabase.from("profiles").update(merged).eq("user_id", existing!.user_id);
      if (error) throw error;
      if (step === total) {
        await supabase.from("profiles").update({ onboarding_complete: true } as any).eq("user_id", existing!.user_id);
        navigate({ to: "/preview" });
      } else {
        setStep((s) => s + 1);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally { setSaving(false); }
  };

  const connectLinkedIn = async () => {
    try {
      // Ensure onboarding is saved before redirecting away
      await supabase.from("profiles").update({
        ...draft, tone: tones.join(", "),
        admired_brands: splitList(brandsText),
        content_topics: splitList(topicsText),
        posting_time: times[0] ?? "09:00",
        posting_times: times,
        onboarding_complete: true,
      } as any).eq("user_id", existing!.user_id);
      const { url } = await getLinkedIn({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "LinkedIn not configured");
    }
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  if (!existing) return null;

  const AiButton = ({ field, className }: { field: Parameters<typeof askAi>[0]; className?: string }) => (
    <Button type="button" size="sm" variant="ghost" onClick={() => askAi(field)} disabled={suggesting === field} className={className}>
      {suggesting === field ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
      Suggest
    </Button>
  );

  const renderStep = () => {
    switch (step) {
      case 1: return (
        <Field title="What's your name?" subtitle="So we can write in your voice.">
          <Input autoFocus value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Jane Doe" />
        </Field>
      );
      case 2: return (
        <Field title="What do you do?" subtitle="Your role or title." action={<AiButton field="role" />}>
          <Input value={draft.role ?? ""} onChange={(e) => set("role", e.target.value)} placeholder="Founder, Head of Growth, …" />
        </Field>
      );
      case 3: return (
        <Field title="Company (optional)" subtitle="Skip if you post as an individual." action={<AiButton field="company" />}>
          <Input value={draft.company ?? ""} onChange={(e) => set("company", e.target.value)} placeholder="Acme Inc — or leave blank" />
        </Field>
      );
      case 4: return (
        <Field title="What industry?" subtitle="One or two words is fine." action={<AiButton field="industry" />}>
          <Input value={draft.industry ?? ""} onChange={(e) => set("industry", e.target.value)} placeholder="B2B SaaS, real estate, fitness, …" />
        </Field>
      );
      case 5: return (
        <Field title="What do you do, in plain English?" subtitle="A few sentences about your work or company." action={<AiButton field="description" />}>
          <Textarea rows={5} value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="I help… / We help…" />
        </Field>
      );
      case 6: return (
        <Field title="Your handles" subtitle="Optional. We use them for context.">
          <div className="space-y-3">
            <Input value={draft.twitter_handle ?? ""} onChange={(e) => set("twitter_handle", e.target.value)} placeholder="@yourhandle" />
            <Input value={draft.linkedin_company_url ?? ""} onChange={(e) => set("linkedin_company_url", e.target.value)} placeholder="linkedin.com/company/…" />
          </div>
        </Field>
      );
      case 7: return (
        <Field title="Pick your tone" subtitle="Choose up to 3 vibes. We'll blend them." action={<AiButton field="tone" />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TONES.map((t) => (
              <button key={t} type="button"
                onClick={() => toggleTone(t)}
                className={`rounded-xl border px-4 py-3 text-sm transition ${tones.includes(t) ? "border-accent bg-accent/10" : "hover:bg-muted"}`}>
                {t}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{tones.length}/3 selected</p>
        </Field>
      );
      case 8: return (
        <Field title="Brands you admire" subtitle="Separate with commas. We'll rotate one in each personal post." action={<AiButton field="brands" />}>
          <Input value={brandsText} onChange={(e) => setBrandsText(e.target.value)} placeholder="Linear, Stripe, Notion" />
        </Field>
      );
      case 9: return (
        <Field title="Topics to cover" subtitle="Separate with commas. Themes you want to be known for." action={<AiButton field="topics" />}>
          <Input value={topicsText} onChange={(e) => setTopicsText(e.target.value)} placeholder="AI in sales, founder lessons, hiring" />
        </Field>
      );
      case 10: return (
        <Field title="When should we post?" subtitle="Add as many times as you like — one post pair per time, in your local timezone.">
          <div className="space-y-3">
            {times.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input type="time" value={t} onChange={(e) => setTimes(times.map((x, j) => j === i ? e.target.value : x))} className="flex-1" />
                {times.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setTimes(times.filter((_, j) => j !== i))} aria-label="Remove time">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setTimes([...times, "12:00"])}>
              <Plus className="mr-1 h-4 w-4" /> Add another time
            </Button>
            <div className="space-y-1.5 pt-2">
              <Label className="text-xs">Timezone</Label>
              <Select value={draft.timezone ?? ""} onValueChange={(v) => set("timezone", v)}>
                <SelectTrigger><SelectValue placeholder="Select your timezone" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label} ({tz.value})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Auto-detected: {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </p>
            </div>
          </div>
        </Field>
      );
      case 11: return (
        <Field title="Connect LinkedIn" subtitle="We'll post to your LinkedIn daily. Click below to authorize — takes 30 seconds.">
          <div className="space-y-3">
            <Button type="button" size="lg" onClick={connectLinkedIn} className="w-full">
              <Linkedin className="mr-2 h-4 w-4" /> Authorize LinkedIn
            </Button>
            <p className="text-xs text-muted-foreground">
              You'll be redirected to LinkedIn to grant permission, then sent back here.
            </p>
          </div>
        </Field>
      );
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Progress value={(step / total) * 100} className="h-1" />
      <p className="mt-3 text-xs text-muted-foreground">Step {step} of {total}</p>
      <div className="mt-10">{renderStep()}</div>
      <div className="mt-10 flex items-center justify-between">
        <Button variant="ghost" onClick={back} disabled={step === 1}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {step === 11 && (
            <Button variant="ghost" onClick={() => saveAndNext()} disabled={saving}>
              Skip for now
            </Button>
          )}
          {step !== 11 && (
            <Button onClick={() => saveAndNext()} disabled={saving}>
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ title, subtitle, children, action }: { title: string; subtitle: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-3xl">{title}</h1>
          {action}
        </div>
        <p className="mt-2 text-muted-foreground">{subtitle}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

const _Label = Label;
