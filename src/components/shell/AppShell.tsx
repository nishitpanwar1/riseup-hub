import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Search, Plus, Bell, Settings, LogOut, Menu, X, Home, Compass, Users, ShoppingBag, BarChart3, Timer, Flame, User as UserIcon, History, Heart, Clock, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { SiteFooterLinks } from "@/components/SiteFooterLinks";
import { MobileTabBar } from "@/components/MobileTabBar";
import { MobileAccountSheet } from "@/components/MobileAccountSheet";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: React.ReactNode; auth?: boolean; search?: Record<string, unknown> };
const MAIN: NavItem[] = [
  { to: "/feed", label: "Home", icon: <Home /> },
  { to: "/shorts", label: "Shorts", icon: <Compass /> },
  { to: "/rooms", label: "Rooms", icon: <Users /> },
  { to: "/shop", label: "Shop", icon: <ShoppingBag /> },
];
const YOURS: NavItem[] = [
  { to: "/feed", label: "History", icon: <History />, auth: true, search: { view: "history" } },
  { to: "/feed", label: "Watch later", icon: <Clock />, auth: true, search: { view: "later" } },
  { to: "/feed", label: "Liked videos", icon: <Heart />, auth: true, search: { view: "liked" } },
  { to: "/studio", label: "Your videos", icon: <BarChart3 />, auth: true },
];
const EXPLORE: NavItem[] = [
  { to: "/feed", label: "Trending", icon: <Flame />, search: { cat: "trending" } },
  { to: "/focus", label: "Focus", icon: <Timer />, auth: true },
  { to: "/settings", label: "Settings", icon: <Settings />, auth: true },
];

export function RiseUpWordmark() {
  return <span className="inline-flex items-center gap-1.5"><span className="grid h-6 w-8 place-items-center rounded-md bg-brand-orange text-media-foreground"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M9 5v14l11-7z" /></svg></span><span className="font-display text-[22px] font-bold">RiseUp</span></span>;
}

export function AppShell({ children, rail, bare, className = "" }: { children: React.ReactNode; rail?: React.ReactNode; bare?: boolean; className?: string }) {
  const [drawer, setDrawer] = useState(false);
  const [compact, setCompact] = useState(false);
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { data: profile } = useMyProfile();
  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!window.matchMedia("(min-width: 1920px)").matches || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      const current = document.activeElement;
      if (current instanceof HTMLInputElement || current instanceof HTMLTextAreaElement || current instanceof HTMLSelectElement || current?.closest('[role="slider"],video,[contenteditable="true"]')) return;
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary')).filter(el => el.getClientRects().length > 0);
      if (!(current instanceof HTMLElement) || current === document.body) { nodes[0]?.focus(); return; }
      const rect = current.getBoundingClientRect(); const x = rect.x + rect.width / 2; const y = rect.y + rect.height / 2;
      const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight"; const positive = event.key === "ArrowRight" || event.key === "ArrowDown";
      const next = nodes.filter(el => el !== current).map(el => { const r = el.getBoundingClientRect(); const dx = r.x + r.width / 2 - x; const dy = r.y + r.height / 2 - y; return { el, along: horizontal ? dx : dy, across: horizontal ? dy : dx }; }).filter(n => positive ? n.along > 4 : n.along < -4).sort((a,b) => (Math.abs(a.along) + Math.abs(a.across) * 3) - (Math.abs(b.along) + Math.abs(b.across) * 3))[0];
      if (next) { event.preventDefault(); next.el.focus(); next.el.scrollIntoView({ block: "nearest" }); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  const toggle = () => { if (window.innerWidth < 1024) setDrawer(d => !d); else setCompact(c => !c); };
  return <div className="min-h-screen bg-background text-foreground">
    <TopBar onMenu={toggle} />
    <div className="flex">
      <aside className={`shell-sidebar ${compact ? "is-compact" : ""} hidden md:flex sticky top-14 h-[calc(100dvh-3.5rem)] shrink-0 flex-col overflow-y-auto scrollbar-none px-3 py-3 bg-background`} aria-label="Main navigation">
        <SideNav /><div className="shell-footer mt-auto pt-6"><SiteFooterLinks className="px-3 pb-4" /></div>
      </aside>
      <main className={`shell-main min-w-0 flex-1 ${bare ? "" : "px-0 sm:px-5 lg:px-6 pt-0 pb-safe-nav md:pb-10"} ${className}`}>
        {rail && !bare ? <div className="grid xl:grid-cols-[minmax(0,1fr)_300px] gap-6"><div className="min-w-0">{children}</div><aside className="hidden xl:block space-y-4">{rail}</aside></div> : children}
      </main>
    </div>
    {drawer && <div className="fixed inset-0 z-50">
      <Button variant="ghost" aria-label="Close navigation" onClick={() => setDrawer(false)} className="absolute inset-0 h-auto w-auto rounded-none bg-media/50 hover:bg-media/50" />
      <div className="relative h-full w-60 max-w-[85vw] bg-background px-3 pb-6 overflow-y-auto">
        <div className="h-14 flex items-center gap-4 mb-3"><Button variant="ghost" size="icon" onClick={() => setDrawer(false)} aria-label="Close menu" className="rounded-full"><X /></Button><RiseUpWordmark /></div>
        <SideNav /><SiteFooterLinks className="p-3 mt-5" />
      </div>
    </div>}
    <MobileTabBar username={profile?.username} />
  </div>;
}
function SideNav() {
  const { data: profile } = useMyProfile();
  const { signedIn } = useAuthGate();
  return <nav className="space-y-3">
    <Section items={MAIN} />
    <div className="nav-extra border-t border-rise pt-3">
      {profile?.username ? <Button asChild variant="ghost" className="w-full justify-start font-semibold"><Link to="/$username" params={{ username: profile.username }}>You <ChevronRight /></Link></Button> : <div className="nav-section-label px-3 py-2 font-semibold">You</div>}
      <Section items={YOURS} />
      {!signedIn && <div className="px-3 py-4 text-sm text-text-secondary"><p>Sign in to like videos, save your favorites, and more.</p><Button asChild variant="outline" className="mt-3 rounded-full text-brand-purple border-rise"><Link to="/auth"><UserIcon /> Sign in</Link></Button></div>}
    </div>
    <div className="nav-extra border-t border-rise pt-3"><div className="nav-section-label px-3 py-2 font-semibold">Explore</div><Section items={EXPLORE} /></div>
  </nav>;
}
function Section({ items }: { items: NavItem[] }) { return <div>{items.map(item => <NavRow key={item.label} item={item} />)}</div>; }
function NavRow({ item }: { item: NavItem }) {
  const { signedIn, requireAuth } = useAuthGate(); const nav = useNavigate();
  const location = useRouterState({ select: s => s.location });
  const search = location.search as Record<string, unknown>;
  const active = location.pathname === item.to && (item.search ? Object.entries(item.search).every(([k,v]) => search[k] === v) : !search.view && !search.cat);
  return <Button variant="ghost" title={item.label} aria-current={active ? "page" : undefined} onClick={() => {
    if (item.auth && !signedIn) { requireAuth(undefined, `Sign in to open ${item.label}.`); return; }
    nav({ to: item.to as any, search: (item.search ?? {}) as any });
  }} className={`nav-row h-auto min-h-10 w-full justify-start gap-5 rounded-lg px-3 py-2 text-sm ${active ? "bg-secondary font-semibold" : "font-normal"}`}><span className="shrink-0 [&_svg]:size-5">{item.icon}</span><span className="nav-label truncate">{item.label}</span></Button>;
}
export function TopBar({ onMenu }: { onMenu?: () => void }) {
  const { user } = useAuth(); const { requireAuth } = useAuthGate(); const nav = useNavigate(); const { data: profile } = useMyProfile();
  const location = useRouterState({ select: s => s.location });
  const currentQ = (location.search as Record<string, unknown>).q;
  const [q, setQ] = useState(typeof currentQ === "string" ? currentQ : "");
  const [mobileSearch, setMobileSearch] = useState(false); const [account, setAccount] = useState(false); const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setQ(typeof currentQ === "string" ? currentQ : ""); }, [currentQ]);
  const submit = (event: React.FormEvent) => { event.preventDefault(); nav({ to: "/feed", search: { q: q.trim() || undefined } }); };
  return <header className="sticky top-0 z-40 bg-background">
    <div className="shell-header h-14 px-3 sm:px-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-6">
      <div className={`items-center gap-3 sm:gap-4 ${mobileSearch ? "hidden sm:flex" : "flex"}`}><Button variant="ghost" size="icon" onClick={onMenu} title="Menu" aria-label="Menu" className="hidden md:inline-flex rounded-full"><Menu className="size-6" /></Button><Link to="/feed" aria-label="RiseUp home"><RiseUpWordmark /></Link></div>
      <form onSubmit={submit} role="search" className={`${mobileSearch ? "flex col-span-2 sm:col-span-1" : "hidden sm:flex"} min-w-0 w-full max-w-[640px] justify-self-center items-center`}>
        {mobileSearch && <Button variant="ghost" size="icon" aria-label="Close search" onClick={() => setMobileSearch(false)} className="sm:hidden shrink-0 rounded-full"><X /></Button>}
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} aria-label="Search" placeholder="Search" className="min-w-0 w-full h-10 pl-5 pr-3 border border-rise rounded-l-full rounded-r-none bg-background text-base focus:border-ring focus:shadow-none" />
        <Button type="submit" variant="secondary" aria-label="Search videos" title="Search" className="h-10 w-16 shrink-0 rounded-l-none rounded-r-full border border-l-0 border-rise"><Search className="size-5" /></Button>
      </form>
      <div className={`${mobileSearch ? "hidden sm:flex" : "flex col-start-3"} items-center gap-1 sm:gap-3 shrink-0`}>
        <Button variant="ghost" size="icon" aria-label="Open search" onClick={() => { setMobileSearch(true); setTimeout(() => inputRef.current?.focus(), 0); }} className="sm:hidden rounded-full"><Search className="size-5" /></Button>
        {user ? <>
          <Button variant="secondary" onClick={() => requireAuth(() => nav({ to: "/studio/upload" }))} className="hidden sm:inline-flex rounded-full"><Plus className="size-5" /> Create</Button>
          <Button asChild variant="ghost" size="icon" className="rounded-full" title="Notifications"><Link to="/notifications" aria-label="Notifications"><Bell className="size-5" /></Link></Button>
          <Button variant="ghost" size="icon" onClick={() => setAccount(true)} aria-label="Account menu" title="Account" className="rounded-full"><UserAvatar src={profile?.avatar_url} name={profile?.display_name ?? profile?.username ?? "You"} className="h-8 w-8" /></Button>
        </> : <Button asChild variant="outline" className="rounded-full border-rise text-brand-purple px-2 sm:px-3"><Link to="/auth"><UserIcon className="hidden sm:block" /> Sign in</Link></Button>}
      </div>
    </div>
    <MobileAccountSheet open={account} onClose={() => setAccount(false)} username={profile?.username ?? null} displayName={profile?.display_name ?? null} avatarUrl={profile?.avatar_url ?? null} email={user?.email ?? null} />
  </header>;
}
