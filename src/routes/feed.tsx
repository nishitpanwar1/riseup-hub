import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Flame, Home, Compass, Users, Swords, User as UserIcon, History as HistoryIcon, Heart, Clock, Trophy, ShoppingBag } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Search = { q?: string; cat?: string; view?: string };

export const Route = createFileRoute("/feed")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
    view: typeof s.view === "string" ? s.view : undefined,
  }),
  component: FeedPage,
});

const CATEGORIES = ["all", "trending", "fitness", "discipline", "study", "mindset", "finance", "morning", "entrepreneur", "sports"] as const;
const FOCUS = ["discipline", "fitness", "study", "entrepreneur", "mindset", "finance", "morning"] as const;

const CAT_BG: Record<string, string> = {
  fitness: "from-emerald-900/60 to-emerald-700/30",
  discipline: "from-purple-900/60 to-purple-700/30",
  study: "from-indigo-900/60 to-indigo-700/30",
  mindset: "from-slate-800/70 to-slate-600/30",
  finance: "from-amber-900/60 to-amber-700/30",
  morning: "from-orange-900/60 to-orange-700/30",
  entrepreneur: "from-pink-900/60 to-pink-700/30",
  sports: "from-red-900/60 to-red-700/30",
  trending: "from-red-900/70 to-orange-700/30",
};
const CAT_BADGE: Record<string, string> = {
  fitness: "bg-emerald-800/70 text-emerald-200",
  discipline: "bg-purple-800/70 text-purple-200",
  study: "bg-indigo-800/70 text-indigo-200",
  mindset: "bg-slate-700/70 text-slate-200",
  finance: "bg-amber-800/70 text-amber-200",
  morning: "bg-orange-800/70 text-orange-200",
  entrepreneur: "bg-pink-800/70 text-pink-200",
  sports: "bg-red-800/70 text-red-200",
  trending: "bg-red-800/70 text-red-200",
};

function FeedPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const cat = (search.cat as (typeof CATEGORIES)[number]) ?? "all";
  const view = search.view ?? "home";
  const q = search.q ?? "";

  // realtime invalidations
  useEffect(() => {
    const ch = supabase
      .channel("videos-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "videos" }, () => {
        qc.invalidateQueries({ queryKey: ["feed"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // base videos query — long-form only; shorts live on /shorts
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["feed", cat],
    queryFn: async () => {
      let qb = supabase
        .from("videos")
        .select("id, title, description, category, video_url, thumbnail_url, duration, like_count, view_count, tags, created_at, is_short, profiles(username, display_name, avatar_url)")
        .eq("status", "active")
        .eq("is_short", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cat === "trending") qb = qb.order("view_count", { ascending: false });
      else if (cat !== "all") qb = qb.eq("category", cat);
      const { data, error } = await qb;
      if (error) throw error;
      return data ?? [];
    },
  });

  // subscribed channels for the sidebar
  const { data: subscribed = [] } = useQuery({
    queryKey: ["subscribed", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", user!.id).limit(20);
      const ids = (follows ?? []).map((f: any) => f.following_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, username, display_name").in("id", ids);
      return data ?? [];
    },
  });

  // view filters (liked/history) — pull user-specific id lists
  const { data: filterIds } = useQuery({
    queryKey: ["feed-filter", view, user?.id],
    enabled: !!user && (view === "liked" || view === "history" || view === "later"),
    queryFn: async () => {
      if (!user) return [] as string[];
      if (view === "liked") {
        const { data } = await supabase.from("video_likes").select("video_id").eq("user_id", user.id);
        return (data ?? []).map((r: any) => r.video_id);
      }
      if (view === "later") {
        const { data } = await supabase.from("video_saves").select("video_id").eq("user_id", user.id);
        return (data ?? []).map((r: any) => r.video_id);
      }
      if (view === "history") {
        const { data } = await supabase.from("video_views").select("video_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
        return (data ?? []).map((r: any) => r.video_id);
      }
      return [];
    },
  });

  const filteredVideos = useMemo(() => {
    let list = videos as any[];
    if ((view === "liked" || view === "history" || view === "later") && filterIds) {
      const set = new Set(filterIds);
      list = list.filter(v => set.has(v.id));
    }
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter((v: any) => {
        const p = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
        return [v.title, v.description, v.category, p?.username, p?.display_name, ...(v.tags ?? [])]
          .filter(Boolean).join(" ").toLowerCase().includes(term);
      });
    }
    return list;
  }, [videos, filterIds, view, q]);

  const featured = filteredVideos[0];
  const grid = filteredVideos.slice(1);

  // streak
  const { data: streak } = useQuery({
    queryKey: ["my-streak", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("streaks").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  // leaders
  const { data: leaders = [] } = useQuery({
    queryKey: ["leaders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, total_views, follower_count, creator_tier")
        .order("follower_count", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  // my ranking
  const { data: myRank } = useQuery({
    queryKey: ["my-rank", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: me } = await supabase.from("profiles").select("username, display_name, follower_count").eq("id", user!.id).maybeSingle();
      if (!me) return null;
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).gt("follower_count", me.follower_count ?? 0);
      return { ...me, rank: (count ?? 0) + 1 };
    },
  });

  // trending topics from tags
  const trendingTopics = useMemo(() => {
    const tally = new Map<string, number>();
    (videos as any[]).forEach(v => (v.tags ?? []).forEach((t: string) => tally.set(t, (tally.get(t) ?? 0) + 1)));
    return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [videos]);

  const setSearch = (patch: Partial<Search>) => navigate({ search: (prev: any) => ({ ...prev, ...patch }) as any });

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-[240px_1fr_320px] gap-6">
        {/* LEFT SIDEBAR */}
        <aside className="lg:sticky lg:top-20 h-fit space-y-4">
          <nav className="card-rise p-2">
            <SideBtn active={view === "home"} onClick={() => setSearch({ view: "home", cat: undefined })} icon={<Home className="w-5 h-5" />} label="Home" />
            <SideLink to="/shorts" icon={<Compass className="w-5 h-5" />} label="Shorts" />
            <SideLink to="/rooms" icon={<Users className="w-5 h-5" />} label="Rooms" />
            <SideLink to="/shop" icon={<ShoppingBag className="w-5 h-5" />} label="Shop" />
            <SideBtn active={cat === "trending"} onClick={() => setSearch({ cat: "trending", view: "home" })} icon={<Swords className="w-5 h-5" />} label="Arena" />
          </nav>

          <div className="card-rise p-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary px-3 pt-2 pb-1">Focus</div>
            {FOCUS.map(f => (
              <SideBtn
                key={f}
                active={cat === f && view === "home"}
                onClick={() => setSearch({ cat: f, view: "home" })}
                icon={<span className="w-5 h-5 inline-flex items-center justify-center text-base">{ICONS[f]}</span>}
                label={f}
                dot={cat === f}
              />
            ))}
          </div>

          <div className="card-rise p-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary px-3 pt-2 pb-1">Library</div>
            <SideLink to="/$username" params={user ? { username: myRank?.username ?? "" } : undefined} icon={<UserIcon className="w-5 h-5" />} label="Profile" disabled={!myRank?.username} />
            <SideBtn active={view === "history"} onClick={() => setSearch({ view: "history" })} icon={<HistoryIcon className="w-5 h-5" />} label="History" disabled={!user} />
            <SideBtn active={view === "liked"} onClick={() => setSearch({ view: "liked" })} icon={<Heart className="w-5 h-5" />} label="Liked" disabled={!user} />
            <SideBtn active={view === "later"} onClick={() => setSearch({ view: "later" })} icon={<Clock className="w-5 h-5" />} label="Saved" disabled={!user} />
          </div>

          {user && subscribed.length > 0 && (
            <div className="card-rise p-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary px-3 pt-2 pb-1">Subscribed</div>
              {subscribed.map((s: any) => (
                <Link
                  key={s.id}
                  to="/$username"
                  params={{ username: s.username }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-surface/60"
                >
                  <span className="w-6 h-6 rounded-full bg-brand-purple flex items-center justify-center text-[10px] font-bold">
                    {(s.display_name ?? s.username).slice(0,2).toUpperCase()}
                  </span>
                  <span className="truncate">{s.display_name ?? s.username}</span>
                </Link>
              ))}
            </div>
          )}

        {/* CENTER */}
        <main>
          {/* category pills */}
          <div className="flex flex-wrap gap-2 mb-5">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setSearch({ cat: c === "all" ? undefined : c, view: "home" })}
                className={`px-4 py-2 rounded-full text-sm font-semibold capitalize border transition-colors ${
                  (cat === c || (c === "all" && cat === "all"))
                    ? "bg-white text-black border-white"
                    : "bg-bg-surface border-rise text-text-secondary hover:text-text-primary"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-text-secondary">Loading the arena…</div>
          ) : filteredVideos.length === 0 ? (
            <div className="card-rise p-12 text-center">
              <p className="text-text-secondary">{q ? `No matches for "${q}"` : "No videos here yet."}</p>
              <Link to="/studio/upload" className="btn-primary inline-block mt-4">Upload one</Link>
            </div>
          ) : (
            <div className="space-y-5">
              {featured && view === "home" && !q && <FeaturedCard video={featured} />}
              <div className="grid sm:grid-cols-2 gap-5">
                {(view === "home" && !q ? grid : filteredVideos).map((v: any) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </div>
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="space-y-4">
          {user && (
            <div className="card-rise p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Your streak</h3>
              </div>
              <div className="rounded-xl border border-rise p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-brand-orange" />
                    <span className="font-bold">{streak?.current_streak ?? 0}-day streak</span>
                  </div>
                  <span className="font-stat font-black text-2xl text-brand-orange">{streak?.current_streak ?? 0}</span>
                </div>
                <StreakBars current={streak?.current_streak ?? 0} />
              </div>
            </div>
          )}

          <div className="card-rise p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Top operators</h3>
              <Trophy className="w-4 h-4 text-accent-gold" />
            </div>
            <ul className="space-y-2">
              {leaders.map((l: any, i: number) => (
                <li key={l.id}>
                  <Link to="/$username" params={{ username: l.username }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-surface">
                    <span className={`font-stat font-black w-5 text-sm ${i === 0 ? "text-accent-gold" : i === 1 ? "text-text-secondary" : i === 2 ? "text-brand-orange" : "text-text-tertiary"}`}>{i + 1}</span>
                    <div className="w-9 h-9 rounded-full bg-bg-surface border border-rise flex items-center justify-center font-bold text-xs">
                      {(l.display_name ?? l.username)?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate text-sm">{l.display_name ?? l.username}</div>
                      <div className="text-xs text-text-tertiary font-stat">{l.follower_count ?? 0} followers</div>
                    </div>
                    <span className="text-xs font-stat font-bold text-text-secondary">{formatK(l.total_views ?? 0)}</span>
                  </Link>
                </li>
              ))}
              {myRank && !leaders.some((l: any) => l.username === myRank.username) && (
                <li className="border-t border-rise pt-2 mt-2">
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-bg-surface">
                    <span className="font-stat font-black w-5 text-sm text-text-tertiary">{myRank.rank}</span>
                    <div className="w-9 h-9 rounded-full bg-brand-purple flex items-center justify-center font-bold text-xs">
                      {(myRank.display_name ?? myRank.username)?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate text-sm">You ({myRank.username})</div>
                      <div className="text-xs text-text-tertiary font-stat">{myRank.follower_count ?? 0} followers</div>
                    </div>
                  </div>
                </li>
              )}
            </ul>
          </div>

          <div className="card-rise p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-3">Trending topics</h3>
            <ul className="space-y-1">
              {trendingTopics.length === 0 && <li className="text-text-tertiary text-sm">No topics yet.</li>}
              {trendingTopics.map(([tag, count]) => (
                <li key={tag}>
                  <button
                    onClick={() => navigate({ search: (prev: any) => ({ ...prev, q: tag }) as any })}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-bg-surface text-left"
                  >
                    <span className="font-semibold text-sm">#{tag}</span>
                    <span className="text-xs text-text-tertiary font-stat">{count} videos</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

const ICONS: Record<string, string> = {
  discipline: "🔥", fitness: "💪", study: "📚", entrepreneur: "🚀", mindset: "🧠", finance: "💰", morning: "🌅",
};

function SideBtn({ active, onClick, icon, label, dot, disabled }: { active?: boolean; onClick: () => void; icon: React.ReactNode; label: string; dot?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold capitalize transition-colors ${
        active ? "bg-bg-surface text-text-primary" : "text-text-secondary hover:text-text-primary hover:bg-bg-surface/60"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {dot && <span className="w-2 h-2 rounded-full bg-brand-orange" />}
    </button>
  );
}

function SideLink({ to, params, icon, label, disabled }: { to: string; params?: any; icon: React.ReactNode; label: string; disabled?: boolean }) {
  if (disabled) {
    return (
      <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-text-tertiary opacity-40 cursor-not-allowed">
        {icon}<span>{label}</span>
      </div>
    );
  }
  return (
    <Link
      to={to as any}
      params={params}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-surface/60"
      activeProps={{ className: "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold bg-bg-surface text-text-primary" }}
    >
      {icon}<span>{label}</span>
    </Link>
  );
}

function FeaturedCard({ video }: { video: any }) {
  const isFresh = Date.now() - new Date(video.created_at).getTime() < 1000 * 60 * 60 * 6;
  const profile = Array.isArray(video.profiles) ? video.profiles[0] : video.profiles;
  return (
    <Link to="/watch/$id" params={{ id: video.id }} className="block card-rise overflow-hidden group">
      <div className={`relative aspect-video bg-gradient-to-br ${CAT_BG[video.category] ?? "from-bg-card to-bg-surface"}`}>
        {video.thumbnail_url && <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" loading="lazy" />}
        {isFresh && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-md bg-red-600 text-white">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE
          </span>
        )}
        <span className="absolute bottom-3 right-3 text-xs px-2 py-0.5 rounded bg-black/70 font-stat">
          {fmtDuration(video.duration)}
        </span>
      </div>
      <div className="p-4">
        <h2 className="font-display font-black text-lg sm:text-xl uppercase leading-tight">{video.title}</h2>
        <div className="mt-2 text-xs text-text-tertiary font-stat">
          {profile && <span>@{profile.username} · </span>}
          {formatK(video.view_count)} views · {timeAgo(video.created_at)}
        </div>
      </div>
    </Link>
  );
}

function VideoCard({ video }: { video: any }) {
  const profile = Array.isArray(video.profiles) ? video.profiles[0] : video.profiles;
  const badge = CAT_BADGE[video.category] ?? "bg-bg-surface text-text-secondary";
  return (
    <Link to="/watch/$id" params={{ id: video.id }} className="card-rise overflow-hidden group block">
      <div className={`relative aspect-video bg-gradient-to-br ${CAT_BG[video.category] ?? "from-bg-card to-bg-surface"}`}>
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" loading="lazy" />
        ) : (
          <video src={video.video_url} muted playsInline preload="none"
            onMouseEnter={(e) => e.currentTarget.play().catch(()=>{})}
            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
            className="w-full h-full object-cover" />
        )}
        <span className={`absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${badge}`}>{video.category}</span>
        <span className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded bg-black/70 font-stat">{fmtDuration(video.duration)}</span>
      </div>
      <div className="p-3 flex gap-3">
        <div className="w-9 h-9 rounded-full bg-bg-surface border border-rise flex items-center justify-center font-bold text-xs shrink-0">
          {(profile?.display_name ?? profile?.username ?? "?").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-snug line-clamp-2 text-sm">{video.title}</h3>
          {profile && <div className="text-xs text-text-secondary mt-1">{profile.display_name ?? profile.username}</div>}
          <div className="text-xs text-text-tertiary font-stat mt-0.5">
            {formatK(video.view_count)} views · {timeAgo(video.created_at)}
          </div>
        </div>
      </div>
    </Link>
  );
}

function StreakBars({ current }: { current: number }) {
  // 7-day visualization — bars filled up to `current` (max 7), with growing height
  const bars = Array.from({ length: 7 }, (_, i) => {
    const filled = i < Math.min(current, 7);
    const h = 30 + i * 8; // px
    return { filled, h };
  });
  return (
    <div className="flex items-end gap-1.5 h-20">
      {bars.map((b, i) => (
        <div key={i} className="flex-1 rounded-md" style={{
          height: `${b.h}px`,
          background: b.filled ? "linear-gradient(to top, #ff6a00, #ffb86b)" : "color-mix(in oklab, var(--bg-surface) 70%, transparent)",
          border: "1px solid color-mix(in oklab, white 8%, transparent)",
        }} />
      ))}
    </div>
  );
}

function fmtDuration(s: number | null | undefined) {
  if (!s) return "0:00";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
function formatK(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${n ?? 0}`;
}
function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} hours ago`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)} days ago`;
  return new Date(iso).toLocaleDateString();
}
