import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_HOSTS = ["link.storjshare.io", "gateway.storjshare.io", "fytcynhzlcprytvhnmoe.supabase.co"];

export const Route = createFileRoute("/api/video")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const src = new URL(request.url).searchParams.get("src");
        if (!src) return new Response("Missing video source", { status: 400 });

        let upstream: URL;
        try {
          upstream = new URL(src);
        } catch {
          return new Response("Invalid video source", { status: 400 });
        }

        if (!ALLOWED_HOSTS.includes(upstream.hostname)) {
          return new Response("Video host not allowed", { status: 403 });
        }

        const res = await fetch(upstream, {
          headers: request.headers.get("range") ? { range: request.headers.get("range")! } : undefined,
        });

        const headers = new Headers(res.headers);
        headers.set("access-control-allow-origin", "*");
        headers.set("cache-control", "public, max-age=3600");
        return new Response(res.body, { status: res.status, headers });
      },
    },
  },
});