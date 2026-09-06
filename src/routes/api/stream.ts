import { createFileRoute } from "@tanstack/react-router";

// Range-capable edge proxy for sponsored ad creatives.
// Only whitelisted filenames are served, so the query param can never be used
// as an open proxy.
const ALLOWED_FILES = new Set(["sponsor_campaign_01.mp4"]);

function baseUrl() {
  const custom = process.env["AD_MEDIA_BASE_URL"];
  if (custom) return custom.replace(/\/+$/, "");
  const supabase = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  return supabase ? `${supabase.replace(/\/+$/, "")}/storage/v1/object/public/videos/ads` : "";
}


export const Route = createFileRoute("/api/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const file = new URL(request.url).searchParams.get("file") ?? "";
        if (!ALLOWED_FILES.has(file)) {
          return new Response("Unknown campaign file", { status: 404 });
        }

        const base = baseUrl();
        if (!base) return new Response("Ad storage not configured", { status: 503 });

        const range = request.headers.get("range");
        const upstream = await fetch(`${base}/${file}`, {
          headers: range ? { range } : undefined,
        });

        const headers = new Headers();
        const copy = ["content-length", "content-range", "etag", "last-modified"];
        for (const h of copy) {
          const v = upstream.headers.get(h);
          if (v) headers.set(h, v);
        }
        // Storage returns octet-stream for these objects; browsers need a media type.
        headers.set("content-type", "video/mp4");
        headers.set("accept-ranges", "bytes");
        headers.set("cache-control", "public, max-age=86400");

        headers.set("access-control-allow-origin", "*");

        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
