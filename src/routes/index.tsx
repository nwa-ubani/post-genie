import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Search, Send } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Auto-Post — Daily thought leader posts on LinkedIn, on autopilot" },
      { name: "description", content: "Auto-Post researches your industry with live Google data, writes a human thought leader post, and publishes it to LinkedIn for you every day." },
      { property: "og:title", content: "Auto-Post — Daily thought leader posts on LinkedIn, on autopilot" },
      { property: "og:description", content: "Live Google research plus AI drafting in your own voice — thought leader content published to LinkedIn every day." },
      { property: "og:url", content: "https://autopost.grownownow.com/" },
    ],
    links: [{ rel: "canonical", href: "https://autopost.grownownow.com/" }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-display text-xl">Auto-Post</Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/auth" className="text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link to="/auth" className="rounded-full bg-primary px-4 py-2 text-primary-foreground">Get started</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 pt-20 pb-32 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">LinkedIn growth, automated</p>
        <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight md:text-6xl">
          Post thought leader content<br />
          <span className="headline-underline">every single day.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Auto-Post researches your industry with live Google data, writes HUMAN thought leader posts, and publishes them on LinkedIn for you.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link to="/auth" className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">
            Start your free build
          </Link>
        </div>

        <section className="mt-28 grid gap-6 text-left sm:grid-cols-3">
          {[
            { icon: Search, title: "Live research", body: "Pulls fresh Google results, People Also Ask, and trending angles for your industry every morning." },
            { icon: Sparkles, title: "Human voice", body: "Upload sample content or references so posts are written in your own voice and style." },
            { icon: Send, title: "Auto-publish", body: "Automatically post content on your LinkedIn at your chosen time." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6">
              <f.icon className="h-5 w-5 text-accent" />
              <h2 className="mt-4 font-display text-xl">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-muted-foreground">
          © Auto-Post. Made for people who want to build in public.
        </div>
      </footer>
    </div>
  );
}
