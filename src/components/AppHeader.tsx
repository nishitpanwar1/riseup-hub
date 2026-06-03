import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Flame, Upload, LogOut, User as UserIcon, Search, Bell, Settings, BarChart3, ShoppingBag } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export function AppHeader() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState<string | null>(null);
  const routerState = useRouterState();
  const initialQ = (routerState.location.search as any)?.q ?? "";
  const [q, setQ] = useState<string>(typeof initialQ === "string" ? initialQ : "");

  useEffect(() => {
    if (!user) { setUsername(null); return; }
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()
      .then(({ data }) => setUsername(data?.username ?? null));
  }, [user]);

  // debounce search → push to /feed?q=
  useEffect(() => {
    const t = setTimeout(() => {
      const current = (routerState.location.search as any)?.q ?? "";
      if (q === current) return;
      nav({ to: "/feed", search: (prev: any) => ({ ...prev, q: q || undefined }) as any });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const signOut = async () => { await supabase.auth.signOut(); nav({ to: "/" }); };

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-[#0a0a0a]/90 border-b border-rise">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Flame className="w-6 h-6 text-brand-orange" />
          <span className="font-display text-xl font-black tracking-tight">RISEUP</span>
        </Link>
        <div className="flex-1 max-w-2xl mx-auto">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search videos or channels"
              className="w-full pl-10 pr-3 py-2.5 bg-bg-surface border border-rise rounded-full text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand-purple"
            />
          </label>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <Link to="/studio/upload" className="btn-primary text-sm py-2 px-4 hidden sm:inline-flex items-center gap-2">
                <Upload className="w-4 h-4" /> Create
              </Link>
              <Link to="/studio" className="p-2 rounded-lg hover:bg-bg-card hidden sm:inline-flex" title="Studio">
                <BarChart3 className="w-5 h-5" />
              </Link>
              <Link to="/shop" className="p-2 rounded-lg hover:bg-bg-card hidden sm:inline-flex" title="Shop">
                <ShoppingBag className="w-5 h-5" />
              </Link>
              <Link to="/notifications" className="p-2 rounded-lg hover:bg-bg-card" title="Notifications">
                <Bell className="w-5 h-5" />
              </Link>
              <Link to="/settings" className="p-2 rounded-lg hover:bg-bg-card hidden sm:inline-flex" title="Settings">
                <Settings className="w-5 h-5" />
              </Link>
              {username ? (
                <Link to="/$username" params={{ username }} className="w-9 h-9 rounded-full bg-brand-purple flex items-center justify-center font-bold text-sm">
                  {username.slice(0, 2).toUpperCase()}
                </Link>
              ) : (
                <span className="w-9 h-9 rounded-full bg-bg-surface flex items-center justify-center"><UserIcon className="w-5 h-5" /></span>
              )}
              <button onClick={signOut} className="p-2 rounded-lg hover:bg-bg-card" title="Sign out">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <Link to="/auth" className="btn-primary text-sm py-2 px-4">Enter the Arena</Link>
          )}
        </div>
      </div>
    </header>
  );
}
