import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowUpRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooterLinks } from "@/components/SiteFooterLinks";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RiseUp — Short video with a daily upload cap" },
      {
        name: "description",
        content:
          "RiseUp is a short-video platform with 7 uploads a day, no infinite scroll, accountability rooms with daily check-ins, and tokens earned only by posting and finishing focus sessions.",
      },
      { property: "og:title", content: "RiseUp — Short video with a daily upload cap" },
      {
        property: "og:description",
        content: "Paginated feeds, a 7-upload daily cap, focus timers, and accountability rooms. Built for people training a habit, not killing time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

/** Hard numbers that are actually enforced in the product. */
const LEDGER: { n: string; unit: string; body: string }[] = [
  { n: "7", unit: "uploads / day", body: "A database-level cap. Nobody floods the feed, including you." },
  { n: "0", unit: "tokens per view", body: "Views pay nothing. Tokens come from posting and finishing focus sessions." },
  { n: "15", unit: "tokens per session", body: "Finish a timed focus block. Three rewarded sessions a day, then it stops." },
  { n: "8", unit: "categories", body: "Discipline, fitness, study, mindset, finance, morning, entrepreneur, sports. That's the whole menu." },
];

const MECHANICS: { k: string; title: string; body: string; to: string; cta: string }[] = [
  {
    k: "01",
    title: "The gateway asks before the feed loads",
    body: "Once a day you pick up to three focus areas and a session budget — 10, 20, 30 or 45 minutes. The ranking is built from that answer, not from whatever kept you staring last night.",
    to: "/feed",
    cta: "See the feed",
  },
  {
    k: "02",
    title: "Focus timer, not a streak sticker",
    body: "Start a timed block on a real task. Progress writes to the server every minute, so closing the tab or switching phones doesn't erase the work. Complete it and the tokens land.",
    to: "/focus",
    cta: "Open focus",
  },
  {
    k: "03",
    title: "Rooms where people notice you missing",
    body: "Public challenge rooms run on daily check-ins. Your row is visible. Skipping is visible. That is the entire enforcement mechanism and it works better than a badge.",
    to: "/rooms",
    cta: "Browse rooms",
  },
  {
    k: "04",
    title: "Tokens buy things people actually made",
    body: "Creators list programs, templates and guides for money or tokens. Token sales move straight to the creator's balance — no ad pool, no revenue share theatre.",
    to: "/shop",
    cta: "Enter the shop",
  },
];

function LandingPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && user) nav({ to: "/feed", replace: true });
  }, [loading, user, nav]);
  if (loading || user) return <div className="min-h-screen bg-bg-primary" />;

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />

      {/* MASTHEAD — asymmetric, ruled, left-weighted */}
      <section className="border-b border-rise">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
          <div className="grid lg:grid-cols-12 gap-y-10 lg:gap-x-10 pt-14 sm:pt-20 pb-12 sm:pb-16">
            <div className="lg:col-span-8">
              <p className="font-mono text-[11px] sm:text-xs uppercase tracking-[0.35em] text-text-tertiary">
                Est. for people mid-rebuild
              </p>
              <h1 className="mt-6 text-[13vw] leading-[0.86] sm:text-7xl lg:text-[7.5rem] font-black uppercase tracking-[-0.03em]">
                Seven posts.
                <br />
                <span className="text-brand-orange">One feed.</span>
                <br />
                No refill.
              </h1>
              <p className="mt-8 max-w-xl text-base sm:text-lg text-text-secondary leading-relaxed">
                RiseUp is short-form video with the exit doors left open. Feeds are paginated, the
                upload count is capped in the database, and the only way to earn anything here is to
                post work or sit down and finish a focus block.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link to="/auth" className="btn-primary inline-flex items-center gap-2">
                  Create an account
                </Link>
                <Link
                  to="/shorts"
                  className="inline-flex items-center gap-1.5 font-mono text-sm uppercase tracking-wider text-text-secondary hover:text-brand-orange border-b border-rise hover:border-brand-orange pb-1"
                >
                  Watch first <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* offset ledger column */}
            <div className="lg:col-span-4 lg:pt-28">
              <div className="border-t border-rise">
                {LEDGER.map((row) => (
                  <div key={row.unit} className="flex gap-5 border-b border-rise py-5">
                    <span className="font-mono text-4xl sm:text-5xl font-bold text-brand-orange leading-none tabular-nums w-16 shrink-0">
                      {row.n}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-text-primary">{row.unit}</div>
                      <p className="mt-1.5 text-sm text-text-secondary leading-snug">{row.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MECHANICS — numbered editorial rows, deliberately uneven */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-8 py-16 sm:py-24">
        <h2 className="font-mono text-xs uppercase tracking-[0.35em] text-text-tertiary">How it actually runs</h2>
        <div className="mt-10 divide-y divide-[#262626] border-y border-rise">
          {MECHANICS.map((m, i) => (
            <div
              key={m.k}
              className={`grid lg:grid-cols-12 gap-4 lg:gap-10 py-8 sm:py-11 ${i % 2 === 1 ? "lg:pl-[8%]" : ""}`}
            >
              <div className="lg:col-span-2 font-mono text-sm text-text-tertiary tracking-widest">{m.k}</div>
              <h3 className="lg:col-span-5 text-2xl sm:text-3xl font-black uppercase leading-[1.05] tracking-tight">
                {m.title}
              </h3>
              <div className="lg:col-span-5">
                <p className="text-text-secondary leading-relaxed">{m.body}</p>
                <Link
                  to={m.to}
                  className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-brand-orange hover:text-text-primary"
                >
                  {m.cta} <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT'S MISSING — the negative space of the product */}
      <section className="border-y border-rise bg-bg-card">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-14 sm:py-20 grid lg:grid-cols-12 gap-8">
          <h2 className="lg:col-span-5 text-3xl sm:text-5xl font-black uppercase leading-[0.95] tracking-tight">
            Things this
            <br />
            app will
            <br />
            <span className="text-text-tertiary">never do</span>
          </h2>
          <ul className="lg:col-span-7 lg:pt-3 space-y-0">
            {[
              "Load another page of video when you reach the bottom.",
              "Pay you tokens for collecting views on old uploads.",
              "Let a single account publish forty clips before lunch.",
              "Recommend cooking, gossip, pranks or reaction content.",
              "Autoplay the next thing while you are trying to leave.",
            ].map((line) => (
              <li key={line} className="flex gap-4 border-b border-rise py-4 text-base sm:text-lg text-text-secondary">
                <span className="font-mono text-brand-orange">—</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CLOSER */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-8 py-20 sm:py-28">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-text-tertiary">Last thing</p>
          <p className="mt-6 text-2xl sm:text-4xl font-black uppercase leading-[1.05] tracking-tight">
            If you finish a session here and close the tab, the product worked.
          </p>
          <Link to="/auth" className="btn-primary mt-9 inline-flex">
            Start today's session
          </Link>
        </div>
      </section>

      <footer className="border-t border-rise">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-10">
          <SiteFooterLinks />
          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-text-tertiary">
            RiseUp — built for those who rise
          </p>
        </div>
      </footer>
    </div>
  );
}
