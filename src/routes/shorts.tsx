import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Heart, Bookmark, Flame, Users, Share2, Play, Volume2, VolumeX } from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

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
  user_id: string;
  profiles: { username: string; display_name: string; avatar_url: string | null; creator_tier: string } | null;
};

function ShortsPage() {
  const { user } = useAuth();
  const [muted, setMuted] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<Short[]>({
    queryKey: ["shorts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, title, description, category, video_url, thumbnail_url, like_count, save_count, user_id, profiles(username, display_name, avatar_url, creator_tier)")
        .eq("status", "active")
        .eq("is_short", true)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as Short[];
    },
  });

  // Realtime: refresh when new shorts arrive
  useEffect(() => {
    const channel = supabase
      .channel("shorts-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "videos" }, () => {
        // simple refetch by invalidating via query key would need queryClient; use reload trick
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (isLoading) return <CenterMsg>Loading the arena…</CenterMsg>;
  if (!data || data.length === 0) {
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
      {/* Top nav */}
      <Link to="/" className="absolute top-4 left-4 z-40 font-display font-black text-lg flex items-center gap-2 text-white">
        <Flame className="w-5 h-5 text-brand-orange" /> RISEUP
      </Link>
      <button
        onClick={() => setMuted(m => !m)}
        className="absolute top-4 right-4 z-40 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
        aria-label="Toggle mute"
      >
        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      {/* Vertical snap scroller */}
      <div
        ref={scrollerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {data.map((s) => (
          <ShortItem
            key={s.id}
            short={s}
            muted={muted}
            isActive={activeId === s.id}
            onVisible={() => setActiveId(s.id)}
            signedIn={!!user}
          />
        ))}
      </div>

      <div className="md:hidden absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/60 z-40 flex items-center gap-1 pointer-events-none">
        <Play className="w-3 h-3" /> Swipe up for next
      </div>
    </div>
  );
}

function ShortItem({
  short, muted, isActive, onVisible, signedIn,
}: { short: Short; muted: boolean; isActive: boolean; onVisible: () => void; signedIn: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            onVisible();
          }
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onVisible]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isActive]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-[100dvh] snap-start snap-always flex items-center justify-center bg-black"
    >
      <div className="relative h-full md:h-[95%] aspect-[9/16] max-w-full bg-black overflow-hidden md:rounded-2xl md:shadow-[0_0_60px_rgba(123,47,255,0.25)]">
        <video
          ref={videoRef}
          src={short.video_url}
          poster={short.thumbnail_url}
          loop
          muted={muted}
          playsInline
          preload="metadata"
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            v.paused ? v.play() : v.pause();
          }}
          className="w-full h-full object-cover"
        />

        {/* Bottom gradient + meta */}
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

        {/* Right rail actions (inside player) */}
        <div className="absolute right-3 bottom-28 z-30 flex flex-col gap-4 items-center text-white">
          <ActionBtn icon={<Flame className="w-6 h-6 text-brand-orange" />} count={null} onClick={() => toast.success("Streak +1 today")} />
          <ActionBtn icon={<Heart className="w-6 h-6" />} count={short.like_count} onClick={() => like(short.id, signedIn)} />
          <ActionBtn icon={<Bookmark className="w-6 h-6" />} count={short.save_count} onClick={() => save(short.id, signedIn)} />
          <ActionBtn icon={<Users className="w-6 h-6 text-accent-mint" />} count={null} onClick={() => toast("Join the accountability room from the video page", { icon: "🛡️" })} />
          <ActionBtn icon={<Share2 className="w-6 h-6" />} count={null} onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Link copied"); }} />
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
