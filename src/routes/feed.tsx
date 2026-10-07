import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, ChevronLeft, ChevronRight, MoreVertical, Clock, User, Search } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { IntentGateway } from "@/components/IntentGateway";
import { emptySignals, rankFeed } from "@/lib/ranking";
import { Button } from "@/components/ui/button";

type Search = { q?: string; cat?: string; view?: string };

export const Route = createFileRoute("/feed")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
    view: typeof s.view === "string" ? s.view : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Home — RiseUp" },
      { name: "description", content: "Your personalized RiseUp feed for discipline, fitness, study, mindset, finance and creator videos." },
      { property: "og:title", content: "Home — RiseUp" },
      { property: "og:description", content: "Watch your personalized creator feed and daily Shorts on RiseUp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeedPage,
});

const CATEGORIES = ["all", "trending", "fitness", "discipline", "study", "mindset", "finance", "morning", "entrepreneur", "sports"] as const;
function FeedPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const cat = (search.cat as (typeof CATEGORIES)[number]) ?? "all";
  const view = search.view ?? "home";
  const q = search.q ?? "";
  const [intentCats, setIntentCats] = useState<string[]>([]);

  // realtime invalidations
  useEffect(() => {
    const ch = supabase
      .channel("videos-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "videos" }, (payload) => {
        const row: any = payload.new;
        if (!row || row.status !== "active") return;
        qc.invalidateQueries({ queryKey: [row.is_short ? "feed-shorts" : "feed"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "videos" }, (payload) => {
        const row: any = payload.new;
        if (!row?.id) return;
        const patch = (old: any) => Array.isArray(old) ? old.map((v: any) => v.id === row.id ? { ...v, like_count: row.like_count, view_count: row.view_count, comment_count: row.comment_count, save_count: row.save_count } : v) : old;
        qc.setQueriesData({ queryKey: ["feed"] }, patch);
        qc.setQueriesData({ queryKey: ["feed-shorts"] }, patch);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "videos" }, (payload) => {
        const old: any = payload.old;
        const remove = (rows: any) => Array.isArray(rows) ? rows.filter((v: any) => v.id !== old?.id) : rows;
        qc.setQueriesData({ queryKey: ["feed"] }, remove);
        qc.setQueriesData({ queryKey: ["feed-shorts"] }, remove);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        applyProfileUpdate(qc, payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // base videos query — long-form only; shorts live on /shorts
  const { data: videos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["feed", cat],
    queryFn: async () => {
      let qb = supabase
        .from("videos")
        .select("id, title, description, category, video_url, thumbnail_url, duration, like_count, view_count, tags, created_at, is_short, user_id, profiles(username, display_name, avatar_url)")
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

  // shorts shelf — always fetch, mixed into feed like YouTube
  const { data: shorts = [] } = useQuery({
    queryKey: ["feed-shorts", cat],
    queryFn: async () => {
      let qb = supabase
        .from("videos")
        .select("id, title, category, video_url, thumbnail_url, view_count, like_count, created_at, user_id, profiles(username, display_name, avatar_url)")
        .eq("status", "active")
        .eq("is_short", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cat !== "all" && cat !== "trending") qb = qb.eq("category", cat);
      const { data } = await qb;
      return data ?? [];
    },
  });

  // personalization signals: per-category + per-creator affinity scores
  const { data: signals } = useQuery({
    queryKey: ["feed-signals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: likes }, { data: views }, { data: saves }, { data: follows }] = await Promise.all([
        supabase.from("video_likes").select("videos(category, user_id)").eq("user_id", user?.id ?? "").limit(200),
        supabase.from("video_views").select("video_id, seconds_watched, total_seconds, videos(category, user_id)").eq("user_id", user?.id ?? "").order("created_at", { ascending: false }).limit(300),
        supabase.from("video_saves").select("videos(category, user_id)").eq("user_id", user?.id ?? "").limit(100),
        supabase.from("follows").select("following_id").eq("follower_id", user?.id ?? ""),
      ]);
      const sig = emptySignals();
      const { catScore, creatorScore } = sig;
      (follows ?? []).forEach((f: any) => { creatorScore.set(f.following_id, (creatorScore.get(f.following_id) ?? 0) + 5); sig.subscriptions.add(f.following_id); });
      const retentionTally = new Map<string, { sum: number; n: number }>();
      (views ?? []).forEach((r: any) => {
        const v = Array.isArray(r.videos) ? r.videos[0] : r.videos;
        if (r.video_id) sig.seenIds.add(r.video_id);
        if (!v?.category) return;
        const ratio = r.total_seconds > 0 ? Math.min(1, (r.seconds_watched ?? 0) / r.total_seconds) : 0.4;
        const cur = retentionTally.get(v.category) ?? { sum: 0, n: 0 };
        retentionTally.set(v.category, { sum: cur.sum + ratio, n: cur.n + 1 });
      });
      retentionTally.forEach((t, k) => sig.retention.set(k, t.sum / Math.max(1, t.n)));
      const bump = (rows: any[] | null, weight: number) => {
        (rows ?? []).forEach((r: any) => {
          const v = Array.isArray(r.videos) ? r.videos[0] : r.videos;
          if (!v) return;
          if (v.category) catScore.set(v.category, (catScore.get(v.category) ?? 0) + weight);
          if (v.user_id) creatorScore.set(v.user_id, (creatorScore.get(v.user_id) ?? 0) + weight);
        });
      };
      bump(views, 1);   // most watched carries the most cumulative weight
      bump(likes, 3);
      bump(saves, 4);
      return sig;
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

  // today's stated intent outranks passive history
  const tunedSignals = useMemo(() => {
    const base = signals ?? emptySignals();
    if (!intentCats.length) return base;
    const catScore = new Map(base.catScore);
    intentCats.forEach((c) => catScore.set(c, (catScore.get(c) ?? 0) + 25));
    return { ...base, catScore };
  }, [signals, intentCats]);

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
    // Ranking algorithm (YouTube-style): engagement + freshness + personalization
    if (view === "home" && cat !== "trending") {
      return rankFeed(list as any[], tunedSignals, "long");
    }
    return list;
  }, [videos, filterIds, view, q, cat, tunedSignals]);

  // rank shorts too — most-watched creators/categories float to the top
  const rankedShorts = useMemo(() => {
    if (!shorts.length) return [];
    return rankFeed(shorts as any[], tunedSignals, "short");
  }, [shorts, tunedSignals]);

  const setSearch = (patch: Partial<Search>) => navigate({ search: (prev: any) => ({ ...prev, ...patch }) as any });

  return (
    <AppShell>
      {user && <IntentGateway onSaved={setIntentCats} />}
      <div className="feed-categories sticky top-14 z-20 px-3 sm:px-0 py-3 mb-5 flex gap-3 overflow-x-auto scrollbar-none bg-background">
        {CATEGORIES.map(c => (
          <Button variant={cat === c ? "default" : "secondary"} size="sm" key={c}
            onClick={() => setSearch({ cat: c === "all" ? undefined : c, view: "home" })}
            className="shrink-0 rounded-lg px-3 capitalize text-sm h-8 font-medium">{c}</Button>
        ))}
      </div>
      {isLoading ? <div className="feed-grid" aria-label="Loading videos">{Array.from({ length: 9 }, (_, i) => <div key={i} className="animate-pulse"><div className="aspect-video rounded-lg bg-secondary" /><div className="flex gap-3 pt-3 px-3 sm:px-0"><div className="size-9 rounded-full bg-secondary shrink-0" /><div className="w-full"><div className="h-4 w-4/5 bg-secondary rounded" /><div className="h-3 w-1/2 bg-secondary rounded mt-3" /></div></div></div>)}</div> : isError ? (
        <div className="py-20 px-4 text-center"><h1 className="text-xl font-semibold">Videos couldn’t load</h1><p className="text-text-secondary mt-2">Check your connection and try again.</p><Button variant="secondary" onClick={() => refetch()} className="mt-5 rounded-full">Try again</Button></div>
      ) : (
        <div className="space-y-9">
          {(q || view !== "home") && <h1 className="text-xl font-semibold px-3 sm:px-0">{q ? `Results for “${q}”` : view === "later" ? "Watch later" : view === "liked" ? "Liked videos" : "History"}</h1>}
          {filteredVideos.length > 0 && <section className="feed-grid" aria-label="Recommended videos">{filteredVideos.slice(0,6).map((v: any) => <VideoCard key={v.id} video={v} />)}</section>}
          {view === "home" && !q && rankedShorts.length > 0 && <ShortsShelf shorts={rankedShorts} />}
          {filteredVideos.length > 6 && <section className="feed-grid" aria-label="More videos">{filteredVideos.slice(6).map((v: any) => <VideoCard key={v.id} video={v} />)}</section>}
          {filteredVideos.length === 0 && (rankedShorts.length === 0 || view !== "home" || q) && <div className="py-20 px-4 text-center">
            <Search className="size-10 mx-auto mb-4 text-text-secondary" />
            <h1 className="text-xl font-semibold">{q ? "No results found" : "No videos here yet"}</h1>
            <p className="mt-2 text-text-secondary">{q ? "Try different keywords or another category." : "New uploads will appear here."}</p>
            <Button asChild variant="secondary" className="mt-5 rounded-full"><Link to="/studio/upload">Upload a video</Link></Button>
          </div>}
        </div>
      )}
    </AppShell>
  );
}

function VideoCard({ video }: { video: any }) {
  const profile = Array.isArray(video.profiles) ? video.profiles[0] : video.profiles;
  return <article className="group min-w-0">
    <Link to="/watch/$id" params={{ id: video.id }} className="feed-video-image block relative aspect-video overflow-hidden rounded-lg bg-media">
      {video.thumbnail_url ? <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" loading="lazy" /> : <video src={video.video_url} muted playsInline preload="metadata" onMouseEnter={e => e.currentTarget.play().catch(() => {})} onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} className="w-full h-full object-cover" />}
      <span className="absolute bottom-2 right-2 text-xs font-medium px-1 py-0.5 rounded bg-media/85 text-media-foreground">{fmtDuration(video.duration)}</span>
    </Link>
    <div className="feed-video-info pt-3 flex gap-3">
      {profile?.username ? <Link to="/$username" params={{ username: profile.username }} className="shrink-0" aria-label={`${profile.display_name ?? profile.username}'s channel`}><UserAvatar src={profile.avatar_url} name={profile.display_name ?? profile.username} className="size-9" /></Link> : <UserAvatar name="Creator" className="size-9" />}
      <div className="min-w-0 flex-1">
        <Link to="/watch/$id" params={{ id: video.id }} className="video-title font-semibold leading-[1.4] line-clamp-2 text-base">{video.title}</Link>
        {profile?.username && <Link to="/$username" params={{ username: profile.username }} className="video-meta block text-sm text-text-secondary mt-1 truncate hover:text-foreground">{profile.display_name ?? profile.username}</Link>}
        <div className="video-meta text-sm text-text-secondary">{formatK(video.view_count)} views · {timeAgo(video.created_at)}</div>
      </div>
      <details className="video-menu shrink-0 -mt-1"><summary aria-label={`Options for ${video.title}`} title="Video options"><MoreVertical className="size-5" /></summary><div className="video-menu-panel">
        <Button asChild variant="ghost" className="w-full justify-start"><Link to="/watch/$id" params={{ id: video.id }}><Play /> Watch video</Link></Button>
        {profile?.username && <Button asChild variant="ghost" className="w-full justify-start"><Link to="/$username" params={{ username: profile.username }}><User /> View channel</Link></Button>}
        <Button asChild variant="ghost" className="w-full justify-start"><Link to="/feed" search={{ view: "later" }}><Clock /> Watch later</Link></Button>
      </div></details>
    </div>
  </article>;
}

function patchProfileInVideo(video: any, row: any) {
  if (!video || video.user_id !== row.id) return video;
  const current = Array.isArray(video.profiles) ? video.profiles[0] : video.profiles;
  return { ...video, profiles: { ...(current ?? {}), username: row.username, display_name: row.display_name, avatar_url: row.avatar_url, creator_tier: row.creator_tier } };
}

function applyProfileUpdate(qc: ReturnType<typeof useQueryClient>, row: any) {
  if (!row?.id) return;
  const patchVideoRows = (old: any) => Array.isArray(old) ? old.map((v: any) => patchProfileInVideo(v, row)) : old;
  qc.setQueriesData({ queryKey: ["feed"] }, patchVideoRows);
  qc.setQueriesData({ queryKey: ["feed-shorts"] }, patchVideoRows);
  qc.setQueriesData({ queryKey: ["subscribed"] }, (old: any) => Array.isArray(old) ? old.map((p: any) => p.id === row.id ? { ...p, username: row.username, display_name: row.display_name, avatar_url: row.avatar_url } : p) : old);
  qc.setQueryData(["leaders"], (old: any) => Array.isArray(old) ? old.map((p: any) => p.id === row.id ? { ...p, username: row.username, display_name: row.display_name, avatar_url: row.avatar_url, follower_count: row.follower_count, total_views: row.total_views } : p) : old);
  qc.setQueriesData({ queryKey: ["my-rank"] }, (old: any) => old?.id === row.id ? { ...old, username: row.username, display_name: row.display_name, avatar_url: row.avatar_url, follower_count: row.follower_count } : old);
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

function ShortsShelf({ shorts }: { shorts: any[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => { const el = railRef.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" }); };
  return <section className="py-2 px-3 sm:px-0">
    <div className="flex items-center justify-between mb-5"><h2 className="flex items-center gap-2 text-xl font-bold"><CompassMark /> Shorts</h2><div className="flex gap-2">
      <Button variant="secondary" size="icon" onClick={() => scroll(-1)} className="hidden sm:inline-flex rounded-full" title="Previous Shorts" aria-label="Previous Shorts"><ChevronLeft /></Button>
      <Button variant="secondary" size="icon" onClick={() => scroll(1)} className="hidden sm:inline-flex rounded-full" title="Next Shorts" aria-label="Next Shorts"><ChevronRight /></Button>
    </div></div>
    <div ref={railRef} className="shorts-grid scrollbar-none">
      {shorts.map((s: any) => <article key={s.id} className="short-tile min-w-0 shrink-0">
        <Link to="/shorts" className="block aspect-[9/16] overflow-hidden rounded-lg bg-media">{s.thumbnail_url ? <img src={s.thumbnail_url} alt={s.title} className="w-full h-full object-cover" loading="lazy" /> : <video src={s.video_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />}</Link>
        <Link to="/shorts" className="mt-3 block text-base font-semibold line-clamp-2 leading-snug">{s.title}</Link><p className="text-sm text-text-secondary mt-1">{formatK(s.view_count ?? 0)} views</p>
      </article>)}
    </div>
  </section>;
}
function CompassMark() { return <svg viewBox="0 0 24 24" className="size-7 text-brand-orange" fill="currentColor" aria-hidden="true"><path d="m16.9 1.6-12 7A4 4 0 0 0 5 15.5l2 1.1-1.6 1a3.2 3.2 0 0 0 3.2 5.5l10.6-6.2a4 4 0 0 0-.1-7L17 8.8l3.1-1.7a3.2 3.2 0 0 0-3.2-5.5ZM10 8.5l6 3.5-6 3.5z" /></svg>; }
