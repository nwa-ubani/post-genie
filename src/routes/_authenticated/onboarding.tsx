import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

type Profile = {
  name?: string; role?: string; company?: string; industry?: string;
  description?: string; twitter_handle?: string; linkedin_company_url?: string;
  tone?: string; admired_brands?: string[]; content_topics?: string[];
  posting_time?: string; timezone?: string; make_webhook_url?: string;
};

const TONES = ["Authoritative", "Friendly", "Witty", "Bold", "Warm", "Analytical"];

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Profile>({});
  const [brandsText, setBrandsText] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [saving, setSaving] = useState(false);
  const total = 12;

  const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  const { data: existing } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").single();
      return data;
    },
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
        timezone: existing.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        make_webhook_url: existing.make_webhook_url ?? "",
      });
      setBrandsText((existing.admired_brands ?? []).join(", "));
      setTopicsText((existing.content_topics ?? []).join(", "));
    }
  }, [existing]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const saveAndNext = async (patch: Partial<Profile> = {}) => {
    setSaving(true);
    try {
      const merged: Profile = {
        ...draft,
        admired_brands: splitList(brandsText),
        content_topics: splitList(topicsText),
        ...patch,
      };
      const { error } = await supabase.from("profiles").update(merged).eq("user_id", existing!.user_id);
      if (error) throw error;
      if (step === total) {
        await supabase.from("profiles").update({ onboarding_complete: true }).eq("user_id", existing!.user_id);
        navigate({ to: "/preview" });
      } else {
        setStep((s) => s + 1);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally { setSaving(false); }
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  if (!existing) return null;

  const renderStep = () => {
    switch (step) {
      case 1: return (
        <Field title="What's your name?" subtitle="So we can write in your voice.">
          <Input autoFocus value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Jane Doe" />
        </Field>
      );
      case 2: return (
        <Field title="What do you do?" subtitle="Your role or title.">
          <Input value={draft.role ?? ""} onChange={(e) => set("role", e.target.value)} placeholder="Founder, Head of Growth, …" />
        </Field>
      );
      case 3: return (
        <Field title="Where do you work?" subtitle="Your company name.">
          <Input value={draft.company ?? ""} onChange={(e) => set("company", e.target.value)} placeholder="Acme Inc" />
        </Field>
      );
      case 4: return (
        <Field title="What industry?" subtitle="One or two words is fine.">
          <Input value={draft.industry ?? ""} onChange={(e) => set("industry", e.target.value)} placeholder="B2B SaaS, real estate, fitness, …" />
        </Field>
      );
      case 5: return (
        <Field title="What does your company do?" subtitle="A few sentences in plain English.">
          <Textarea rows={5} value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="We help…" />
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
        <Field title="Pick your tone" subtitle="The vibe of your personal posts.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TONES.map((t) => (
              <button key={t} type="button"
                onClick={() => set("tone", t)}
                className={`rounded-xl border px-4 py-3 text-sm transition ${draft.tone === t ? "border-accent bg-accent/10" : "hover:bg-muted"}`}>
                {t}
              </button>
            ))}
          </div>
        </Field>
      );
      case 8: return (
        <Field title="Brands you admire" subtitle="Comma-separated. We'll rotate one in each personal post.">
          <Input value={(draft.admired_brands ?? []).join(", ")}
            onChange={(e) => set("admired_brands", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
            placeholder="Linear, Stripe, Notion" />
        </Field>
      );
      case 9: return (
        <Field title="Topics to cover" subtitle="Comma-separated themes you want to be known for.">
          <Input value={(draft.content_topics ?? []).join(", ")}
            onChange={(e) => set("content_topics", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
            placeholder="AI in sales, founder lessons, hiring" />
        </Field>
      );
      case 10: return (
        <Field title="When should we post?" subtitle="Your local time.">
          <div className="grid grid-cols-2 gap-3">
            <Input type="time" value={draft.posting_time ?? "09:00"} onChange={(e) => set("posting_time", e.target.value)} />
            <Input value={draft.timezone ?? ""} onChange={(e) => set("timezone", e.target.value)} placeholder="Timezone" />
          </div>
        </Field>
      );
      case 11: return (
        <Field title="Make.com webhook" subtitle="Optional. We POST your brand post here so you can route it to a company page.">
          <Input value={draft.make_webhook_url ?? ""} onChange={(e) => set("make_webhook_url", e.target.value)} placeholder="https://hook.make.com/…" />
        </Field>
      );
      case 12: return (
        <Field title="Connect LinkedIn" subtitle="We post your personal post automatically. You can connect now or from Settings.">
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            LinkedIn OAuth will appear in <span className="text-foreground">Settings</span> once your API keys are configured.
            For now, finish onboarding and we'll show you a live preview of your first day.
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
        <Button onClick={() => saveAndNext()} disabled={saving}>
          {step === total ? "Finish" : "Continue"} <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Field({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">{title}</h1>
        <p className="mt-2 text-muted-foreground">{subtitle}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

const _Label = Label;
