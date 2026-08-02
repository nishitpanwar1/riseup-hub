import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Compass, Plus, Users, User as UserIcon, ShoppingBag } from "lucide-react";

/**
 * YouTube-app style bottom tab bar. Mobile / tablet only — desktop keeps the
 * left sidebar.
 */
export function MobileTabBar({ username }: { username?: string | null }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const item = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-2 text-[10px] font-semibold ${
      active ? "text-text-primary" : "text-text-tertiary"
    }`;

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0a0a0a]/95 backdrop-blur border-t border-rise pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch">
        <Link to="/feed" className={item(pathname === "/feed")}>
          <Home className="w-5 h-5 shrink-0" />
          <span className="truncate">Home</span>
        </Link>
        <Link to="/shorts" className={item(pathname === "/shorts")}>
          <Compass className="w-5 h-5 shrink-0" />
          <span className="truncate">Shorts</span>
        </Link>
        <Link to="/studio/upload" className="flex flex-col items-center justify-center flex-1 min-w-0 py-2">
          <span className="w-11 h-8 rounded-full bg-bg-surface border border-rise flex items-center justify-center">
            <Plus className="w-5 h-5 text-text-primary" />
          </span>
        </Link>
        <Link to="/rooms" className={item(pathname.startsWith("/rooms"))}>
          <Users className="w-5 h-5 shrink-0" />
          <span className="truncate">Rooms</span>
        </Link>
        {username ? (
          <Link to="/$username" params={{ username }} className={item(pathname === `/${username}`)}>
            <UserIcon className="w-5 h-5 shrink-0" />
            <span className="truncate">You</span>
          </Link>
        ) : (
          <Link to="/shop" className={item(pathname === "/shop")}>
            <ShoppingBag className="w-5 h-5 shrink-0" />
            <span className="truncate">Shop</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
