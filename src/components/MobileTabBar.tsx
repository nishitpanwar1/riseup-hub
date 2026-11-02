import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Compass, Plus, Users, User as UserIcon } from "lucide-react";
export function MobileTabBar({ username }: { username?: string | null }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const item = (active: boolean) => `flex flex-col items-center justify-center gap-1 min-w-0 h-14 text-[10px] font-mono uppercase tracking-wide ${active ? "text-foreground font-semibold" : "text-text-secondary"}`;
  return <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg-primary border-t border-rise pb-[env(safe-area-inset-bottom)]">
    <div className="grid grid-cols-5 items-stretch">
      <Link to="/feed" className={`${item(pathname === "/feed")} ${pathname === "/feed" ? "shadow-[inset_0_2px_0_var(--color-brand-orange)]" : ""}`}><Home className={`size-5 ${pathname === "/feed" ? "text-brand-orange" : ""}`} /><span>Home</span></Link>
      <Link to="/shorts" className={`${item(pathname === "/shorts")} ${pathname === "/shorts" ? "shadow-[inset_0_2px_0_var(--color-brand-orange)]" : ""}`}><Compass className={`size-5 ${pathname === "/shorts" ? "text-brand-orange" : ""}`} /><span>Shorts</span></Link>
      <Link to="/studio/upload" aria-label="Create video" className="grid place-items-center h-14"><span className="grid place-items-center size-9 bg-brand-orange text-white corner-cut-sm"><Plus className="size-6" /></span></Link>
      <Link to="/rooms" className={`${item(pathname.startsWith("/rooms"))} ${pathname.startsWith("/rooms") ? "shadow-[inset_0_2px_0_var(--color-brand-orange)]" : ""}`}><Users className={`size-5 ${pathname.startsWith("/rooms") ? "text-brand-orange" : ""}`} /><span>Rooms</span></Link>
      {username ? <Link to="/$username" params={{ username }} search={{ view: "you" } as any} className={`${item(pathname === `/${username}`)} ${pathname === `/${username}` ? "shadow-[inset_0_2px_0_var(--color-brand-orange)]" : ""}`}><UserIcon className={`size-5 ${pathname === `/${username}` ? "text-brand-orange" : ""}`} /><span>You</span></Link> : <Link to="/auth" className={`${item(pathname === "/auth")} ${pathname === "/auth" ? "shadow-[inset_0_2px_0_var(--color-brand-orange)]" : ""}`}><UserIcon className={`size-5 ${pathname === "/auth" ? "text-brand-orange" : ""}`} /><span>You</span></Link>}
    </div>
  </nav>;
}
