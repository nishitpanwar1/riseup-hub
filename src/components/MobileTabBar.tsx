import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Compass, Plus, Users, User as UserIcon } from "lucide-react";
export function MobileTabBar({ username }: { username?: string | null }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const item = (active: boolean) => `flex flex-col items-center justify-center gap-1 min-w-0 h-14 text-[10px] ${active ? "text-foreground font-semibold" : "text-text-secondary"}`;
  return <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background border-t border-rise pb-[env(safe-area-inset-bottom)]">
    <div className="grid grid-cols-5 items-stretch">
      <Link to="/feed" className={item(pathname === "/feed")}><Home className={`size-5 ${pathname === "/feed" ? "fill-current" : ""}`} /><span>Home</span></Link>
      <Link to="/shorts" className={item(pathname === "/shorts")}><Compass className="size-5" /><span>Shorts</span></Link>
      <Link to="/studio/upload" aria-label="Create video" className="grid place-items-center h-14"><span className="grid place-items-center size-9 rounded-full border border-rise"><Plus className="size-6" /></span></Link>
      <Link to="/rooms" className={item(pathname.startsWith("/rooms"))}><Users className="size-5" /><span>Rooms</span></Link>
      {username ? <Link to="/$username" params={{ username }} search={{ view: "you" } as any} className={item(pathname === `/${username}`)}><UserIcon className="size-5" /><span>You</span></Link> : <Link to="/auth" className={item(pathname === "/auth")}><UserIcon className="size-5" /><span>You</span></Link>}
    </div>
  </nav>;
}
