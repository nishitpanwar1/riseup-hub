import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, Heart, UserPlus, Users, Flame, Check } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/notifications")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: NotificationsPage,
});

const FILTERS = [
  { id: "all", label: "All", icon: Bell },
  { id: "follow", label: "Follows", icon: UserPlus },
  { id: "like", label: "Likes", icon: Heart },
  { id: "room", label: "Rooms", icon: Users },
  { id: "streak", label: "Streaks", icon: Flame },
] as const;

type FilterId = typeof FILTERS[number]["id"];

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterId>("all");

  const { data: notifs } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  // realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notifs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const filtered = (notifs ?? []).filter(n => filter === "all" || n.type === filter);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <aside className="card-rise p-4 h-fit">
          <p className="text-xs uppercase tracking-wider text-text-tertiary font-bold mb-3">Filter</p>
          <nav className="space-y-1">
            {FILTERS.map(f => {
              const Icon = f.icon;
              const active = filter === f.id;
              const unread = (notifs ?? []).filter(n => (f.id === "all" || n.type === f.id) && !n.is_read).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${active ? "bg-bg-surface text-text-primary" : "text-text-secondary hover:bg-bg-surface"}`}
                >
                  <span className="flex items-center gap-2"><Icon className="w-4 h-4" /> {f.label}</span>
                  {unread > 0 && <span className="w-2 h-2 rounded-full bg-accent-red" />}
                </button>
              );
            })}
          </nav>
        </aside>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-black uppercase">Notifications</h1>
            <button onClick={markAllRead} className="btn-ghost text-xs py-2 px-3 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Mark all read</button>
          </div>
          <div className="card-rise divide-y divide-[#262626]">
            {filtered.length === 0 && (
              <p className="p-10 text-center text-text-tertiary">Nothing here yet.</p>
            )}
            {filtered.map(n => (
              <Row key={n.id} n={n} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ n }: { n: any }) {
  const Icon = n.type === "follow" ? UserPlus : n.type === "like" ? Heart : n.type === "room" ? Users : n.type === "streak" ? Flame : Bell;
  const ago = relTime(n.created_at);
  const inner = (
    <div className={`flex items-start gap-3 p-4 ${!n.is_read ? "bg-bg-surface/40" : ""}`}>
      <div className="w-10 h-10 rounded-full bg-bg-surface flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-brand-orange" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">{n.title}</p>
        <p className="text-sm text-text-secondary">{n.message}</p>
        <p className="text-xs text-text-tertiary mt-1 font-stat">{ago}</p>
      </div>
      {!n.is_read && <span className="w-2 h-2 rounded-full bg-accent-red mt-2" />}
    </div>
  );
  if (n.type === "like" && n.related_id) return <Link to="/watch/$id" params={{ id: n.related_id }}>{inner}</Link>;
  return inner;
}

function relTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}
