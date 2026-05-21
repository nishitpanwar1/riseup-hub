import { Link, useNavigate } from "@tanstack/react-router";
import { Flame, Home, Compass, Users, Upload, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export function AppHeader() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setUsername(null); return; }
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()
      .then(({ data }) => setUsername(data?.username ?? null));
  }, [user]);

  const signOut = async () => { await supabase.auth.signOut(); nav({ to: "/" }); };

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-[#1A0533]/85 border-b border-rise">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2">
          <Flame className="w-6 h-6 text-brand-orange" />
          <span className="font-display text-xl font-black tracking-tight">RISEUP</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          <NavItem to="/feed" icon={<Home className="w-4 h-4" />} label="Feed" />
          <NavItem to="/shorts" icon={<Compass className="w-4 h-4" />} label="Shorts" />
          <NavItem to="/rooms" icon={<Users className="w-4 h-4" />} label="Rooms" />
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/studio/upload" className="btn-primary text-sm py-2 px-4 hidden sm:inline-flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload
              </Link>
              {username && (
                <Link to="/$username" params={{ username }} className="p-2 rounded-lg hover:bg-bg-card">
                  <UserIcon className="w-5 h-5" />
                </Link>
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

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card font-semibold text-sm"
      activeProps={{ className: "flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-card text-text-primary font-semibold text-sm" }}
    >
      {icon} {label}
    </Link>
  );
}
