import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Search, Send } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GrowNowNow — Daily LinkedIn posts on autopilot" },
      { name: "description", content: "Researches your industry with live Google data, writes two AI posts daily, and publishes to LinkedIn for you." },
      { property: "og:title", content: "GrowNowNow — Daily LinkedIn posts on autopilot" },
      { property: "og:description", content: "Live Google research plus AI drafting — a brand post and a personal post, published to LinkedIn every day." },
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
        <Link to="/" className="font-display text-xl">GrowNowNow</Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/auth" className="text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link to="/auth" className="rounded-full bg-primary px-4 py-2 text-primary-foreground">Get started</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 pt-20 pb-32 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">LinkedIn growth, automated</p>
        <h1 className="mt-6 font-display text-5xl leading-[1.05] sm:text-7xl">
          Two thoughtful posts.<br />
          <span className="headline-underline">Every single day.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          GrowNowNow researches your industry with live Google data, writes a brand post and a
          personal post, and publishes to LinkedIn for you while you sleep.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link to="/auth" className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">
            Start your free build
          </Link>
        </div>

        <section className="mt-28 grid gap-6 text-left sm:grid-cols-3">
          {[
            { icon: Search, title: "Live research", body: "Pulls fresh Google results, People Also Ask, and trending angles for your industry every morning." },
            { icon: Sparkles, title: "Two voices", body: "An authoritative brand post and a personal, lowercase note — both grounded in today's data." },
            { icon: Send, title: "Auto-publish", body: "Personal posts go live on your LinkedIn at your chosen time. Company posts hand off to Make.com." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6">
              <f.icon className="h-5 w-5 text-accent" />
              <h3 className="mt-4 font-display text-xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-muted-foreground">
          © GrowNowNow. Made for people who'd rather build than caption.
        </div>
      </footer>
    </div>
  );
}
