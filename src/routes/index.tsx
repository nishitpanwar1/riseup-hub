import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Zap, Target, Users, ShieldCheck, TrendingUp } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />

      {/* HERO */}
      <section className="relative gradient-hero overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-bg-card border border-rise text-xs font-semibold text-text-secondary mb-8">
            <Flame className="w-3.5 h-3.5 text-brand-orange" /> NO ALGORITHMIC INFINITE SCROLL
          </div>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black uppercase leading-[0.95] tracking-tight">
            The only platform<br/>built for your <span className="text-brand-orange">rise.</span>
          </h1>
          <p className="mt-8 text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto">
            Short-form video designed for growth, not distraction. Discipline. Fitness. Mindset. Money. Movement.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/auth" className="btn-primary inline-flex items-center gap-2 text-lg">
              <Zap className="w-5 h-5" /> Enter the Arena
            </Link>
            <Link to="/shorts" className="btn-ghost inline-flex items-center gap-2 text-lg">
              Explore Feed
            </Link>
          </div>
        </div>
      </section>

      {/* MANIFESTO */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-3xl sm:text-5xl font-black uppercase text-center">The rules of the arena</h2>
        <div className="mt-12 grid sm:grid-cols-3 gap-5">
          <Rule icon={<Target className="text-brand-orange" />} title="No doomscroll" body="Paginated feeds, not infinite traps. Watch, learn, leave." />
          <Rule icon={<Users className="text-accent-mint" />} title="Accountability rooms" body="Public challenge rooms with daily check-ins. Show up or get cut." />
          <Rule icon={<ShieldCheck className="text-accent-gold" />} title="Trust-scored creators" body="Verified, rising, elite tiers. Earned by consistency, never bought." />
          <Rule icon={<Flame className="text-brand-orange" />} title="Streak-first" body="Your watch-day streak is the hero metric — not vanity views." />
          <Rule icon={<TrendingUp className="text-accent-mint" />} title="Self-improvement only" body="Eight categories. Zero entertainment. No food, no gossip, no slop." />
          <Rule icon={<Zap className="text-accent-gold" />} title="Tip the operators" body="Internal token ledger. Reward signal, not algorithms." />
        </div>
      </section>

      <footer className="border-t border-rise py-10 text-center text-sm text-text-tertiary">
        Built for those who rise. © RiseUp
      </footer>
    </div>
  );
}

function Rule({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card-rise p-6">
      <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center mb-4">{icon}</div>
      <h3 className="text-lg font-bold uppercase tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-text-secondary">{body}</p>
    </div>
  );
}
