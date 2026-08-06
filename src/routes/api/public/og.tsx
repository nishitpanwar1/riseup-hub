import { createFileRoute } from "@tanstack/react-router";

/**
 * Dynamic OpenGraph image engine.
 *
 * Every profile, video and product link pasted into X, WhatsApp, Discord or
 * Telegram renders a live dark-theme card (avatar, rank, streak, view count),
 * generated at the edge on request — free organic distribution.
 */
export const Route = createFileRoute("/api/public/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const type = url.searchParams.get("type") ?? "profile";

        const base = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];

        const rest = async (path: string) => {
          if (!base || !key) return null;
          const res = await fetch(`${base}/rest/v1/${path}`, {
            headers: { apikey: key, Accept: "application/json" },
          });
          if (!res.ok) return null;
          const rows = (await res.json()) as any[];
          return rows?.[0] ?? null;
        };

        const esc = (s: unknown) =>
          String(s ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        const nfmt = (n: unknown) => {
          const v = Number(n ?? 0);
          if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
          if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
          return String(v);
        };

        let title = "RiseUp";
        let subtitle = "The platform built for your rise";
        let avatar: string | null = null;
        let cover: string | null = null;
        let stats: { label: string; value: string }[] = [
          { label: "Shorts", value: "Daily" },
          { label: "Focus", value: "Discipline" },
          { label: "Noise", value: "Zero" },
        ];
        let badge = "RISEUP";

        try {
          if (type === "profile") {
            const username = url.searchParams.get("u") ?? "";
            const profile = await rest(
              `profiles?username=eq.${encodeURIComponent(username)}&select=id,username,display_name,avatar_url,bio,follower_count,total_views,creator_tier&limit=1`,
            );
            if (profile) {
              const streakRow = await rest(
                `streaks?user_id=eq.${profile.id ?? ""}&select=current_streak&limit=1`,
              );
              title = profile.display_name || profile.username;
              subtitle = profile.bio || `@${profile.username}`;
              avatar = profile.avatar_url;
              badge = String(profile.creator_tier ?? "new").toUpperCase();
              stats = [
                { label: "Followers", value: nfmt(profile.follower_count) },
                { label: "Views", value: nfmt(profile.total_views) },
                { label: "Streak", value: `${streakRow?.current_streak ?? 0}🔥` },
              ];
            }
          } else if (type === "video") {
            const id = url.searchParams.get("id") ?? "";
            const video = await rest(
              `videos?id=eq.${encodeURIComponent(id)}&select=title,thumbnail_url,view_count,like_count,category,is_short&limit=1`,
            );
            if (video) {
              title = video.title;
              subtitle = String(video.category ?? "").toUpperCase();
              cover = video.thumbnail_url;
              badge = video.is_short ? "SHORT" : "VIDEO";
              stats = [
                { label: "Views", value: nfmt(video.view_count) },
                { label: "Likes", value: nfmt(video.like_count) },
                { label: "On", value: "RiseUp" },
              ];
            }
          } else if (type === "product") {
            const id = url.searchParams.get("id") ?? "";
            const product = await rest(
              `digital_products?id=eq.${encodeURIComponent(id)}&select=title,description,cover_url,price_cents,token_price,sold_count&limit=1`,
            );
            if (product) {
              title = product.title;
              subtitle = product.description ?? "Digital product on RiseUp";
              cover = product.cover_url;
              badge = "SHOP";
              stats = [
                { label: "Price", value: product.price_cents ? `$${(product.price_cents / 100).toFixed(0)}` : "—" },
                { label: "Tokens", value: product.token_price ? String(product.token_price) : "—" },
                { label: "Sold", value: nfmt(product.sold_count) },
              ];
            }
          }
        } catch {
          // fall through to the branded default card
        }

        const media = avatar
          ? `<img src="${esc(avatar)}" width="200" height="200" style="width:200px;height:200px;border-radius:100px;object-fit:cover;border:6px solid #FF6B35;" />`
          : cover
            ? `<img src="${esc(cover)}" width="360" height="202" style="width:360px;height:202px;border-radius:20px;object-fit:cover;border:4px solid #4A2D7A;" />`
            : `<div style="display:flex;width:200px;height:200px;border-radius:100px;background:#FF6B35;align-items:center;justify-content:center;font-size:96px;font-weight:900;color:#0a0a0a;">R</div>`;

        const statCards = stats
          .map(
            (s) => `<div style="display:flex;flex-direction:column;padding:16px 26px;border-radius:16px;background:#1b1030;border:1px solid #4A2D7A;">
              <span style="font-size:34px;font-weight:900;color:#F5F0FF;">${esc(s.value)}</span>
              <span style="font-size:18px;color:#9A8FB5;text-transform:uppercase;letter-spacing:2px;">${esc(s.label)}</span>
            </div>`,
          )
          .join("");

        const html = `
          <div style="display:flex;flex-direction:column;justify-content:space-between;width:1200px;height:630px;padding:64px;background:linear-gradient(135deg,#0a0a0a 0%,#1a0b2e 55%,#2D1155 100%);font-family:sans-serif;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;">
                <div style="display:flex;width:56px;height:56px;border-radius:16px;background:#FF6B35;align-items:center;justify-content:center;font-size:34px;font-weight:900;color:#0a0a0a;">R</div>
                <span style="margin-left:18px;font-size:40px;font-weight:900;color:#F5F0FF;letter-spacing:-1px;">RiseUp</span>
              </div>
              <span style="padding:10px 22px;border-radius:999px;background:rgba(255,107,53,0.15);border:1px solid #FF6B35;color:#FF6B35;font-size:20px;font-weight:800;letter-spacing:3px;">${esc(badge)}</span>
            </div>

            <div style="display:flex;align-items:center;">
              ${media}
              <div style="display:flex;flex-direction:column;margin-left:44px;width:640px;">
                <span style="font-size:${title.length > 42 ? 52 : 68}px;font-weight:900;color:#F5F0FF;line-height:1.05;">${esc(title.slice(0, 80))}</span>
                <span style="margin-top:16px;font-size:26px;color:#9A8FB5;line-height:1.3;">${esc(subtitle.slice(0, 110))}</span>
              </div>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;gap:18px;">${statCards}</div>
              <span style="font-size:22px;color:#6f6288;">riseup · rise every day</span>
            </div>
          </div>`;

        const cache = "public, max-age=300, s-maxage=600, stale-while-revalidate=86400";
        try {
          // Loaded lazily: the renderer ships WebAssembly that only resolves in
          // the edge runtime, so local dev falls back to the SVG card below.
          const { ImageResponse } = await import("workers-og");
          return new ImageResponse(html, {
            width: 1200,
            height: 630,
            headers: { "Cache-Control": cache },
          });
        } catch {
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><foreignObject width="1200" height="630"><div xmlns="http://www.w3.org/1999/xhtml">${html}</div></foreignObject></svg>`;
          return new Response(svg, {
            headers: { "Content-Type": "image/svg+xml", "Cache-Control": cache },
          });
        }
      },
    },
  },
});
