import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  // No landing page: the feed is the platform.
  beforeLoad: () => {
    throw redirect({ to: "/feed", replace: true });
  },
  head: () => ({
    meta: [
      { title: "RiseUp — Short video for people building discipline" },
      {
        name: "description",
        content:
          "Watch short-form video on discipline, fitness, study, mindset and money. Seven uploads a day, focus timers and accountability rooms.",
      },
      { property: "og:title", content: "RiseUp — Short video for people building discipline" },
      { property: "og:description", content: "Watch first. Sign in when you want to post, focus or join a room." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
