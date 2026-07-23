import { createFileRoute, Link } from "@tanstack/react-router";

const CANONICAL = "https://autopost.grownownow.com/blog/automate-linkedin-posts-with-ai";

export const Route = createFileRoute("/blog/automate-linkedin-posts-with-ai")({
  head: () => ({
    meta: [
      { title: "How to automate LinkedIn posts with AI — Auto-Post" },
      { name: "description", content: "A practical workflow for automating LinkedIn posts with AI: live research, drafting with a real angle, and scheduling daily publishing." },
      { property: "og:title", content: "How to automate LinkedIn posts with AI" },
      { property: "og:description", content: "A practical workflow: live research, AI drafting with a real angle, and daily scheduled publishing." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "How to automate LinkedIn posts with AI",
          description:
            "A practical workflow for automating LinkedIn posts with AI: live research, drafting with a real angle, and scheduling daily publishing.",
          author: { "@type": "Organization", name: "Auto-Post" },
          publisher: { "@type": "Organization", name: "Auto-Post" },
          mainEntityOfPage: CANONICAL,
        }),
      },
    ],
  }),
  component: Post,
});

function Post() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-display text-xl">Auto-Post</Link>
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-24 pt-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Guide</p>
        <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
          How to automate LinkedIn posts with AI
        </h1>
        <p className="mt-4 text-muted-foreground">
          The hard part of posting daily on LinkedIn isn't writing — it's finding something worth saying every
          morning. Here's the workflow we use inside Auto-Post to make AI drafts that sound like a person who
          actually read the news.
        </p>

        <article className="prose prose-neutral mt-10 max-w-none">
          <h2 className="mt-10 font-display text-2xl">1. Start with live research, not a blank prompt</h2>
          <p>
            Generic AI posts read generic because the model has nothing new to react to. Before drafting,
            pull today's Google results for two or three queries tied to your role and industry — organic
            titles, People Also Ask, and related searches. That single step gives the model a real angle
            and stops it from recycling last year's takes.
          </p>

          <h2 className="mt-10 font-display text-2xl">2. Draft two posts, not one</h2>
          <p>
            Split the day into a brand post (authoritative, 250–300 words, no emojis) and a personal
            post (lowercase, 150–250 words, one small opinion). The same research feeds both prompts, but
            the tones don't compete for the same feed slot.
          </p>

          <h2 className="mt-10 font-display text-2xl">3. Pick the hook from People Also Ask</h2>
          <p>
            The strongest first line is usually a question your audience is already Googling. Let the
            model pick one PAA entry as the hook — it's a free way to make the post feel of-the-moment
            without manually skimming search results.
          </p>

          <h2 className="mt-10 font-display text-2xl">4. Attach a photo the model didn't generate</h2>
          <p>
            Rotate through a small library of your own headshots, action shots, or product photos.
            LinkedIn's algorithm penalises stock imagery, and a photo you took is the fastest signal
            that a human is behind the account.
          </p>

          <h2 className="mt-10 font-display text-2xl">5. Schedule, don't post</h2>
          <p>
            Pick one posting time per day and let a scheduler publish for you. Consistency at the same
            hour matters more than posting at the "optimal" time — the feed rewards a rhythm.
          </p>

          <h2 className="mt-10 font-display text-2xl">Doing this without the busywork</h2>
          <p>
            Auto-Post runs the whole loop — Serper research, Gemini drafts, image rotation, LinkedIn
            publishing — every morning at the time you choose. If you'd rather skip the plumbing,{" "}
            <Link to="/auth" className="underline">start your free build</Link>.
          </p>
        </article>
      </main>
    </div>
  );
}
