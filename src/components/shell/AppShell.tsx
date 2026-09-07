import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Flame, Search, Upload, Bell, Settings, LogOut, Menu, X,
  Home, Compass, Users, ShoppingBag, BarChart3, Timer, Swords,
  User as UserIcon, History as HistoryIcon, Heart, Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { SiteFooterLinks } from "@/components/SiteFooterLinks";
import { MobileTabBar } from "@/components/MobileTabBar";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  auth?: boolean;
  search?: Record<string, unknown>;
};

const MAIN: NavItem[] = [
  { to: "/feed", label: "Home", icon: <Home className="w-5 h-5" /> },
  { to: "/shorts", label: "Shorts", icon: <Compass className="w-5 h-5" /> },
  { to: "/feed", label: "Arena", icon: <Swords className="w-5 h-5" />, search: { cat: "trending" } },
  { to: "/rooms", label: "Rooms", icon: <Users className="w-5 h-5" /> },
  { to: "/shop", label: "Shop", icon: <ShoppingBag className="w-5 h-5" /> },
];

const YOURS: NavItem[] = [
  { to: "/focus", label: "Focus", icon: <Timer className="w-5 h-5" />, auth: true },
  { to: "/studio", label: "Studio", icon: <BarChart3 className="w-5 h-5" />, auth: true },
  { to: "/feed", label: "History", icon: <HistoryIcon className="w-5 h-5" />, auth: true, search: { view: "history" } },
  { to: "/feed", label: "Liked", icon: <Heart className="w-5 h-5" />, auth: true, search: { view: "liked" } },
  { to: "/feed", label: "Saved", icon: <Clock className="w-5 h-5" />, auth: true, search: { view: "later" } },
];

/**
 * Platform-wide layout: top bar + left navigation + content + optional stats rail.
 * Phone -> bottom tab bar, tablet -> icon rail, laptop -> full rail,
 * TV / ultrawide -> wider grid and larger type.
 */
export function AppShell({
  children,
  rail,
  bare,
  className = "",
}: {
  children: React.ReactNode;
  /** Right-hand stats column, shown from xl up. */
  rail?: React.ReactNode;
  /** Full-bleed pages (Shorts) hide the chrome padding. */
  bare?: boolean;
  className?: string;
}) {
  const [drawer, setDrawer] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useMyProfile();
  const username = profile?.username ?? null;

  useEffect(() => { setDrawer(false); }, [pathname]);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <TopBar onMenu={() => setDrawer((d) => !d)} />

      <div className="flex">
        {/* Persistent navigation: icon rail on tablet, full rail from lg */}
        <aside className="hidden md:flex sticky top-14 sm:top-16 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] shrink-0 flex-col overflow-y-auto scrollbar-none border-r border-rise w-[76px] lg:w-60 px-2 py-3">
          <SideNav compactClass="lg:hidden" />
          <div className="hidden lg:block mt-auto pt-4">
            <SiteFooterLinks className="px-2 pb-2" />
          </div>
        </aside>

        <main
          className={`min-w-0 flex-1 ${bare ? "" : "px-3 sm:px-5 py-4 sm:py-6 pb-safe-nav md:pb-8"} ${className}`}
        >
          {bare ? (
            children
          ) : (
            <div className="mx-auto w-full max-w-[1400px] 2xl:max-w-[1800px] grid xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
              <div className="min-w-0">{children}</div>
              {rail ? <div className="hidden xl:block space-y-4">{rail}</div> : null}
            </div>
          )}
        </main>
      </div>

      {/* Mobile drawer */}
      {drawer && (
        <div className="md:hidden fixed inset-0 z-50">
          <button aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute inset-0 bg-black/70" />
          <div className="relative h-full w-72 max-w-[80vw] bg-bg-card border-r border-rise p-3 overflow-y-auto">
            <div className="flex items-center justify-between px-2 pb-3">
              <span className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-brand-orange" />
                <span className="font-display font-black tracking-tight">RISEUP</span>
              </span>
              <button onClick={() => setDrawer(false)} aria-label="Close" className="p-1 rounded-lg hover:bg-bg-surface">
                <X className="w-5 h-5" />
              </button>
            </div>
            <SideNav />
            <SiteFooterLinks className="px-2 py-4" />
          </div>
        </div>
      )}

      <MobileTabBar username={username} />
    </div>
  );
}

function SideNav({ compactClass = "" }: { compactClass?: string }) {
  return (
    <nav className="space-y-4">
      <Section label="Browse" compactClass={compactClass} items={MAIN} />
      <Section label="You" compactClass={compactClass} items={YOURS} />
    </nav>
  );
}

function Section({ label, items, compactClass }: { label: string; items: NavItem[]; compactClass: string }) {
  return (
    <div className="border-t border-rise first:border-t-0 pt-3 first:pt-0">
      <div className={`px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-tertiary ${compactClass || ""} md:max-lg:hidden`}>
        {label}
      </div>
      {items.map((it) => <NavRow key={`${it.to}-${it.label}`} item={it} />)}
    </div>
  );
}

function NavRow({ item }: { item: NavItem }) {
  const { signedIn, requireAuth } = useAuthGate();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchState = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });

  const active =
    pathname === item.to &&
    (!item.search || Object.entries(item.search).every(([k, v]) => searchState?.[k] === v));

  const go = () => {
    if (item.auth && !signedIn) {
      requireAuth(undefined, `Sign in to open ${item.label}. Watching videos and Shorts stays free.`);
      return;
    }
    nav({ to: item.to as any, search: (item.search ?? {}) as any });
  };

  return (
    <button
      onClick={go}
      title={item.label}
      className={`w-full flex items-center gap-4 rounded-xl text-sm font-semibold transition-colors
        px-3 py-2.5 md:max-lg:flex-col md:max-lg:gap-1 md:max-lg:px-1 md:max-lg:py-3
        ${active ? "bg-bg-surface text-text-primary" : "text-text-secondary hover:text-text-primary hover:bg-bg-surface/60"}`}
    >
      <span className="shrink-0">{item.icon}</span>
      <span className="truncate md:max-lg:text-[10px] md:max-lg:font-bold">{item.label}</span>
    </button>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const nav = useNavigate();
  const { data: profile } = useMyProfile();
  const username = profile?.username ?? null;
  const routerState = useRouterState();
  const initialQ = (routerState.location.search as any)?.q ?? "";
  const [q, setQ] = useState<string>(typeof initialQ === "string" ? initialQ : "");

  useEffect(() => {
    const t = setTimeout(() => {
      const current = (routerState.location.search as any)?.q ?? "";
      if (q === current) return;
      if (!q.trim() && !current) return;
      if (routerState.location.pathname !== "/feed" && !q.trim()) return;
      nav({ to: "/feed", search: (prev: any) => ({ ...prev, q: q || undefined }) as any });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const signOut = async () => { await supabase.auth.signOut(); nav({ to: "/feed" }); };

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-[#0a0a0a]/95 border-b border-rise">
      <div className="h-14 sm:h-16 px-2 sm:px-4 flex items-center gap-2 sm:gap-4">
        <button onClick={onMenu} aria-label="Menu" className="p-2 rounded-full hover:bg-bg-surface md:hidden">
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/feed" className="flex items-center gap-2 shrink-0 pr-1">
          <Flame className="w-6 h-6 text-brand-orange" />
          <span className="font-display text-lg sm:text-xl font-black tracking-tight hidden sm:inline">RISEUP</span>
        </Link>

        <div className="flex-1 min-w-0 max-w-2xl mx-auto">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search RiseUp"
              aria-label="Search"
              className="w-full pl-10 pr-3 py-2 sm:py-2.5 bg-bg-surface border border-rise rounded-full text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand-purple"
            />
          </label>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {user ? (
            <>
              <button
                onClick={() => requireAuth(() => nav({ to: "/studio/upload" }))}
                className="btn-primary text-sm py-2 px-4 hidden sm:inline-flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Create
              </button>
              <Link to="/notifications" title="Notifications" className="p-2 rounded-full hover:bg-bg-surface hidden sm:inline-flex">
                <Bell className="w-5 h-5" />
              </Link>
              <Link to="/settings" title="Settings" className="p-2 rounded-full hover:bg-bg-surface hidden lg:inline-flex">
                <Settings className="w-5 h-5" />
              </Link>
              {username ? (
                <Link to="/$username" params={{ username }} title="Your channel" className="shrink-0">
                  <UserAvatar src={profile?.avatar_url} name={profile?.display_name ?? username} className="w-9 h-9" />
                </Link>
              ) : (
                <span className="w-9 h-9 rounded-full bg-bg-surface flex items-center justify-center"><UserIcon className="w-5 h-5" /></span>
              )}
              <button onClick={signOut} title="Sign out" className="p-2 rounded-full hover:bg-bg-surface hidden lg:inline-flex">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <Link to="/auth" className="btn-primary text-sm py-2 px-3 sm:px-4 whitespace-nowrap">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
