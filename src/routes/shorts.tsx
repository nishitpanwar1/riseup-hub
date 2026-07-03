import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Bookmark, Flame, Users, Share2, Play, Volume2, VolumeX, ChevronLeft, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { resolveVideoSrc } from "@/lib/video-url";

export const Route = createFileRoute("/shorts")({
  component: ShortsPage,
});

type Short = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  video_url: string;
  thumbnail_url: string;
  like_count: number;
  save_count: number;
  view_count: number;
  user_id: string;
  created_at: string;
  profiles: { username: string; display_name: string; avatar_url: string | null; creator_tier: string } | null;
};

const PAGE = 8;
const STORAGE_KEY = "riseup:shorts:active";

const SELECT = "id, title, description, category, video_url, thumbnail_url, like_count, save_count, view_count, user_id, created_at, profiles(username, display_name, avatar_url, creator_tier)";

function ShortsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [muted, setMuted] = useState(true);
  const [items, setItems] = useState<Short[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const restoredRef = useRef(false);
  const seenIds = useRef<Set<string>>(new Set());

  // initial load
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("videos")
        .select(SELECT)
        .eq("status", "active")
        .eq("is_short", true)
        .order("created_at", { ascending: false })
        .limit(PAGE);
      if (!error && data) {
        const rows = data as unknown as Short[];
        rows.forEach(r => seenIds.current.add(r.id));
        setItems(rows);
        setHasMore(rows.length === PAGE);
      }
      setLoading(false);
    })();
  }, []);

  // load next page (older items, cursor = created_at)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || items.length === 0) return;
    setLoadingMore(true);
    const cursor = items[items.length - 1].created_at;
    const { data, error } = await supabase
      .from("videos")
      .select(SELECT)
      .eq("status", "active")
      .eq("is_short", true)
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (!error && data) {
      const rows = (data as unknown as Short[]).filter(r => !seenIds.current.has(r.id));
      rows.forEach(r => seenIds.current.add(r.id));
      setItems(prev => [...prev, ...rows]);
      setHasMore(rows.length === PAGE);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, items]);

  // realtime: prepend new uploads
  useEffect(() => {
    const channel = supabase
      .channel("shorts-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "videos" }, async (payload) => {
        const row: any = payload.new;
        if (!row || row.is_short !== true || row.status !== "active" || seenIds.current.has(row.id)) return;
        // fetch with profile join
        const { data } = await supabase.from("videos").select(SELECT).eq("id", row.id).maybeSingle();
        if (data) {
          seenIds.current.add(row.id);
          setItems(prev => [data as unknown as Short, ...prev]);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "videos" }, (payload) => {
        const row: any = payload.new;
        if (!row) return;
        setItems(prev => prev.map(s => s.id === row.id ? { ...s, like_count: row.like_count, save_count: row.save_count, view_count: row.view_count } : s));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // restore active item once items load
  useEffect(() => {
    if (restoredRef.current || items.length === 0) return;
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
    const target = saved && items.find(i => i.id === saved) ? saved : items[0].id;
    setActiveId(target);
    // scroll without smooth on restore
    requestAnimationFrame(() => {
      const el = itemRefs.current.get(target);
      if (el && scrollerRef.current) {
        scrollerRef.current.scrollTo({ top: el.offsetTop, behavior: "auto" });
      }
    });
    restoredRef.current = true;
  }, [items]);

  // persist active id
  useEffect(() => {
    if (activeId) sessionStorage.setItem(STORAGE_KEY, activeId);
  }, [activeId]);

  // load more when active is near the end
  useEffect(() => {
    if (!activeId || items.length === 0) return;
    const idx = items.findIndex(i => i.id === activeId);
    if (idx >= 0 && idx >= items.length - 3) loadMore();
  }, [activeId, items, loadMore]);

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);

  if (loading) return <CenterMsg>Loading the arena…</CenterMsg>;
  if (items.length === 0) {
    return (
      <CenterMsg>
        <p className="font-display font-black text-3xl uppercase">No shorts yet</p>
        <p className="text-text-secondary mt-2">Be the first to upload.</p>
        <Link to="/studio/upload" className="btn-primary inline-block mt-6">Upload a short</Link>
      </CenterMsg>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <Link to="/" className="absolute top-4 left-4 z-40 font-display font-black text-lg flex items-center gap-2 text-white">
        <Flame className="w-5 h-5 text-brand-orange" /> RISEUP
      </Link>
      <button
        onClick={() => nav({ to: "/feed" })}
        className="absolute top-14 left-4 z-40 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
        aria-label="Back to feed"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={() => setMuted(m => !m)}
        className="absolute top-4 right-4 z-40 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
        aria-label="Toggle mute"
      >
        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
      <button
        onClick={async () => { await supabase.auth.signOut(); nav({ to: "/" }); }}
        className="absolute top-14 right-4 z-40 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="w-5 h-5" />
      </button>

      <div
        ref={scrollerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollSnapType: "y mandatory", overscrollBehavior: "contain" }}
      >
        {items.map((s, i) => {
          const activeIdx = items.findIndex(x => x.id === activeId);
          const anchor = activeIdx === -1 ? 0 : activeIdx;
          // Mount active + neighbors so the next short is already buffered (no swipe lag).
          const mount = Math.abs(i - anchor) <= 1;
          return (
            <ShortItem
              key={s.id}
              short={s}
              muted={muted}
              isActive={activeId === s.id}
              shouldMount={mount}
              onVisible={() => setActiveId(s.id)}
              signedIn={!!user}
              registerRef={registerRef}
            />
          );
        })}
        {loadingMore && (
          <div className="h-20 flex items-center justify-center text-white/60 text-sm">Loading more…</div>
        )}
        {!hasMore && (
          <div className="h-20 flex items-center justify-center text-white/40 text-xs uppercase tracking-wider">You're all caught up</div>
        )}
      </div>

      <div className="md:hidden absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/60 z-40 flex items-center gap-1 pointer-events-none">
        <Play className="w-3 h-3" /> Swipe up for next
      </div>
    </div>
  );
}

function ShortItem({
  short, muted, isActive, shouldMount, onVisible, signedIn, registerRef,
}: { short: Short; muted: boolean; isActive: boolean; shouldMount: boolean; onVisible: () => void; signedIn: boolean; registerRef: (id: string, el: HTMLDivElement | null) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);
  const viewedRef = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    registerRef(short.id, el);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) onVisible();
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(el);
    return () => { io.disconnect(); registerRef(short.id, null); };
  }, [onVisible, registerRef, short.id]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.currentTime = 0;
      v.play().catch(() => {});
      if (!viewedRef.current) {
        viewedRef.current = true;
        supabase.auth.getUser().then(({ data }) => {
          supabase.from("video_views").insert({ video_id: short.id, user_id: data.user?.id ?? null, seconds_watched: 0, total_seconds: Math.round(v.duration || 0) }).then(() => {});
        });
      }
    } else {
      v.pause();
    }
  }, [isActive, shouldMount]);

  const handleTap = () => {
    const v = videoRef.current;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      like(short.id, signedIn);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-[100dvh] snap-start snap-always flex items-center justify-center bg-black"
    >
      <div className="relative h-full md:h-[95%] aspect-[9/16] max-w-full bg-black overflow-hidden md:rounded-2xl md:shadow-[0_0_60px_rgba(123,47,255,0.25)] flex items-center justify-center">
        {shouldMount ? (
          <video
            ref={videoRef}
            src={resolveVideoSrc(short.video_url)}
            poster={short.thumbnail_url}
            loop
            muted={muted}
            playsInline
            preload={isActive ? "auto" : "none"}
            onClick={handleTap}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              const bar = progressRef.current;
              if (bar && v.duration) bar.style.width = `${(v.currentTime / v.duration) * 100}%`;
            }}
            className="max-w-full max-h-full w-auto h-auto object-contain"
          />
        ) : (
          <img src={short.thumbnail_url} alt="" className="max-w-full max-h-full w-auto h-auto object-contain opacity-70" loading="lazy" />
        )}

        {isActive && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-30">
            <div ref={progressRef} className="h-full bg-brand-orange" style={{ width: "0%" }} />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-5 pr-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white">
          {short.profiles && (
            <Link to="/$username" params={{ username: short.profiles.username }} className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full bg-bg-surface border-2 border-brand-purple flex items-center justify-center font-bold">
                {short.profiles.display_name[0]?.toUpperCase()}
              </div>
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  @{short.profiles.username}
                  {short.profiles.creator_tier !== "new" && <span className="text-xs text-accent-gold">●</span>}
                </div>
                <span className="text-xs uppercase tracking-wide text-brand-orange font-bold">{short.category}</span>
              </div>
            </Link>
          )}
          <h2 className="font-display font-black text-xl uppercase leading-tight">{short.title}</h2>
          {short.description && <p className="text-sm text-white/75 mt-1 line-clamp-2">{short.description}</p>}
        </div>

        <div className="absolute right-3 bottom-28 z-30 flex flex-col gap-4 items-center text-white">
          <ActionBtn icon={<Flame className="w-6 h-6 text-brand-orange" />} count={null} onClick={() => toast.success("Streak +1 today")} />
          <ActionBtn icon={<Heart className="w-6 h-6" />} count={short.like_count} onClick={() => like(short.id, signedIn)} />
          <ActionBtn icon={<Play className="w-6 h-6" />} count={short.view_count} onClick={() => {}} />
          <ActionBtn icon={<Bookmark className="w-6 h-6" />} count={short.save_count} onClick={() => save(short.id, signedIn)} />
          <ActionBtn icon={<Users className="w-6 h-6 text-accent-mint" />} count={null} onClick={() => toast("Join the accountability room from the video page", { icon: "🛡️" })} />
          <ActionBtn icon={<Share2 className="w-6 h-6" />} count={null} onClick={() => shareShort(short.title)} />
        </div>
      </div>
    </div>
  );
}

async function like(videoId: string, signedIn: boolean) {
  if (!signedIn) return toast.error("Sign in to like");
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { error } = await supabase.from("video_likes").insert({ video_id: videoId, user_id: u.user.id });
  if (error && !error.message.includes("duplicate")) return toast.error(error.message);
  toast.success("Liked");
}
async function save(videoId: string, signedIn: boolean) {
  if (!signedIn) return toast.error("Sign in to save");
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { error } = await supabase.from("video_saves").insert({ video_id: videoId, user_id: u.user.id });
  if (error) return toast.error(error.message);
  toast.success("Saved to your playlist");
}

async function shareShort(title: string) {
  const url = window.location.href;
  if (typeof navigator !== "undefined" && (navigator as any).share) {
    try { await (navigator as any).share({ title, url }); return; } catch (_e) { /* user cancelled */ }
  }
  try { await navigator.clipboard?.writeText(url); toast.success("Link copied"); } catch (_e) { toast.error("Could not share"); }
}

function ActionBtn({ icon, count, onClick }: { icon: React.ReactNode; count: number | null; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <span className="w-12 h-12 rounded-full bg-black/50 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-white/10">
        {icon}
      </span>
      {count !== null && <span className="text-xs font-stat font-semibold drop-shadow">{count}</span>}
    </button>
  );
}

function CenterMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-center px-4">
      <div>{children}</div>
    </div>
  );
}
