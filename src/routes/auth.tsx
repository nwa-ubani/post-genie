import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Auto-Post" },
      { name: "description", content: "Sign in or create your Auto-Post account to set up daily AI-researched LinkedIn posts on autopilot." },
      { property: "og:title", content: "Sign in — Auto-Post" },
      { property: "og:description", content: "Sign in or create your Auto-Post account to set up daily LinkedIn posts on autopilot." },
      { property: "og:url", content: "https://autopost.grownownow.com/auth" },
    ],
    links: [{ rel: "canonical", href: "https://autopost.grownownow.com/auth" }],
  }),
  component: () => <Outlet />,
});
