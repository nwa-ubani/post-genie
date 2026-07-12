import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — GrowNowNow" },
      { name: "description", content: "Sign in or create your GrowNowNow account to set up daily AI-researched LinkedIn posts on autopilot." },
      { property: "og:title", content: "Sign in — GrowNowNow" },
      { property: "og:description", content: "Sign in or create your GrowNowNow account to set up daily LinkedIn posts on autopilot." },
      { property: "og:url", content: "https://autopost.grownownow.com/auth" },
    ],
    links: [{ rel: "canonical", href: "https://autopost.grownownow.com/auth" }],
  }),
  component: () => <Outlet />,
});
