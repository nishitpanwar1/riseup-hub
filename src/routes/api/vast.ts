import { createFileRoute } from "@tanstack/react-router";

// Same-origin VAST proxy for the RichAds pre-roll endpoint. It fills the
// [IP] and [USER_AGENT] macros with the real viewer's values (which the
// browser can't know itself) and returns the VAST XML to the IMA SDK.
const RICHADS_BASE = "https://16793.rtb.adp3.net/pre-roll-rp?pubid=1024379&siteid=409012";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
};

const EMPTY_VAST = '<?xml version="1.0" encoding="UTF-8"?><VAST version="3.0"></VAST>';

export const Route = createFileRoute("/api/vast")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const h = request.headers;
        const ip =
          h.get("cf-connecting-ip") ??
          h.get("x-real-ip") ??
          h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "";
        const ua = (h.get("user-agent") ?? "").slice(0, 512);
        const url = `${RICHADS_BASE}&ip=${encodeURIComponent(ip)}&ua=${encodeURIComponent(ua)}`;
        try {
          const upstream = await fetch(url, {
            headers: { "user-agent": ua, accept: "application/xml,text/xml,*/*" },
          });
          const body = upstream.ok ? await upstream.text() : EMPTY_VAST;
          return new Response(body || EMPTY_VAST, {
            status: 200,
            headers: { ...cors, "content-type": "application/xml; charset=utf-8", "cache-control": "no-store" },
          });
        } catch {
          return new Response(EMPTY_VAST, {
            status: 200,
            headers: { ...cors, "content-type": "application/xml; charset=utf-8", "cache-control": "no-store" },
          });
        }
      },
    },
  },
});
