import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Flame, Upload, LogOut, User as UserIcon, Search, Bell, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useMyProfile } from "@/hooks/use-profile";
import { BackButton } from "@/components/BackButton";
import { MobileAccountSheet } from "@/components/MobileAccountSheet";

export function AppHeader({ backTo }: { backTo?: boolean }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: profile } = useMyProfile();
  const username = profile?.username ?? null;
  const avatarUrl = profile?.avatar_url ?? null;
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const initialQ = (routerState.location.search as any)?.q ?? "";
  const [q, setQ] = useState<string>(typeof initialQ === "string" ? initialQ : "");
  const [sheet, setSheet] = useState(false);

  const showBack = backTo ?? (pathname !== "/feed" && pathname !== "/");

  // debounce search → push to /feed?q=
  useEffect(() => {
    const t = setTimeout(() => {
      const current = (routerState.location.search as any)?.q ?? "";
      const path = routerState.location.pathname;
      if (q === current) return;
      if (!q.trim() && !current) return;
      if (path !== "/feed" && !q.trim()) return;
      nav({ to: "/feed", search: (prev: any) => ({ ...prev, q: q || undefined }) as any });
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const signOut = async () => { await supabase.auth.signOut(); nav({ to: "/" }); };

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-[#0a0a0a]/95 border-b border-rise">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center gap-2 sm:gap-4">
        {showBack && <span className="shrink-0"><BackButton /></span>}
        <Link to="/" className={`items-center gap-2 shrink-0 ${showBack ? "hidden md:flex" : "flex"}`}>
          <Flame className="w-6 h-6 text-brand-orange" />
          <span className="font-display text-lg sm:text-xl font-black tracking-tight">RISEUP</span>
        </Link>
        <div className="flex-1 min-w-0 max-w-2xl sm:mx-auto">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="w-full pl-10 pr-3 py-2 sm:py-2.5 bg-bg-surface border border-rise rounded-full text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand-purple"
            />
          </label>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {user ? (
            <>
              <Link to="/studio/upload" className="btn-primary text-sm py-2 px-4 hidden sm:inline-flex items-center gap-2">
                <Upload className="w-4 h-4" /> Create
              </Link>
              <Link to="/notifications" className="p-2 rounded-lg hover:bg-bg-card hidden sm:inline-flex" title="Notifications">
                <Bell className="w-5 h-5" />
              </Link>
              <Link to="/settings" className="p-2 rounded-lg hover:bg-bg-card hidden sm:inline-flex" title="Settings">
                <Settings className="w-5 h-5" />
              </Link>

              {/* Mobile: avatar opens the native-style account sheet */}
              <button
                onClick={() => setSheet(true)}
                aria-label="Account menu"
                className="lg:hidden w-9 h-9 rounded-full overflow-hidden bg-brand-purple flex items-center justify-center font-bold text-sm shrink-0"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={username ?? "account"} className="w-full h-full object-cover" />
                ) : (
                  (username ?? "U").slice(0, 2).toUpperCase()
                )}
              </button>

              {/* Desktop: avatar links straight to the channel */}
              {username ? (
                <Link to="/$username" params={{ username }} className="hidden lg:flex w-9 h-9 rounded-full overflow-hidden bg-brand-purple items-center justify-center font-bold text-sm shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                  ) : (
                    username.slice(0, 2).toUpperCase()
                  )}
                </Link>
              ) : (
                <span className="hidden lg:flex w-9 h-9 rounded-full bg-bg-surface items-center justify-center"><UserIcon className="w-5 h-5" /></span>
              )}
              <button onClick={signOut} className="p-2 rounded-lg hover:bg-bg-card hidden lg:inline-flex" title="Sign out">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <Link to="/auth" className="btn-primary text-sm py-2 px-3 sm:px-4 whitespace-nowrap">Enter</Link>
          )}
        </div>
      </div>
      <MobileAccountSheet
        open={sheet}
        onClose={() => setSheet(false)}
        username={username}
        displayName={profile?.display_name ?? null}
        avatarUrl={avatarUrl}
        email={user?.email ?? null}
      />
    </header>
  );
}
