import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
import { Heart, Bookmark, Flame, Users, Share2, ChevronUp, ChevronDown, Play, Volume2, VolumeX } from "lucide-react";
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
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<Short[]>({
    queryKey: ["shorts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, title, description, category, video_url, thumbnail_url, like_count, save_count, user_id, profiles(username, display_name, avatar_url, creator_tier)")
        .eq("status", "active")
        .eq("is_short", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Short[];
    },
  });

  const next = useCallback(() => setIdx(i => Math.min((data?.length ?? 1) - 1, i + 1)), [data]);
  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); next(); }
      if (e.key === "ArrowUp") { e.preventDefault(); prev(); }
      if (e.key === "m") setMuted(m => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  if (isLoading) {
    return <CenterMsg>Loading the arena…</CenterMsg>;
  }
  if (!data || data.length === 0) {
    return (
      <CenterMsg>
        <p className="font-display font-black text-3xl uppercase">No shorts yet</p>
        <p className="text-text-secondary mt-2">Be the first to upload.</p>
        <Link to="/studio/upload" className="btn-primary inline-block mt-6">Upload a short</Link>
      </CenterMsg>
    );
  }

  const current = data[idx];

  return (
    <div ref={containerRef} className="fixed inset-0 bg-bg-primary flex items-center justify-center overflow-hidden">
      {/* Top nav */}
      <Link to="/" className="absolute top-4 left-4 z-30 font-display font-black text-lg flex items-center gap-2">
        <Flame className="w-5 h-5 text-brand-orange" /> RISEUP
      </Link>
      <span className="absolute top-4 right-4 z-30 px-3 py-1 rounded-full bg-bg-card border border-rise text-xs font-semibold font-stat">
        {idx + 1} / {data.length}
      </span>

      {/* Player */}
      <div className="relative h-full max-h-[100dvh] aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-[0_0_60px_rgba(123,47,255,0.25)]">
        <video
          key={current.id}
          src={current.video_url}
          poster={current.thumbnail_url}
          autoPlay
          loop
          muted={muted}
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Bottom gradient + meta */}
        <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
          {current.profiles && (
            <Link to="/$username" params={{ username: current.profiles.username }} className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full bg-bg-surface border-2 border-brand-purple flex items-center justify-center font-bold">
                {current.profiles.display_name[0]?.toUpperCase()}
              </div>
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  @{current.profiles.username}
                  {current.profiles.creator_tier !== "new" && <span className="text-xs text-accent-gold">●</span>}
                </div>
                <span className="text-xs uppercase tracking-wide text-brand-orange font-bold">{current.category}</span>
              </div>
            </Link>
          )}
          <h2 className="font-display font-black text-xl uppercase leading-tight">{current.title}</h2>
          {current.description && <p className="text-sm text-text-secondary mt-1 line-clamp-2">{current.description}</p>}
        </div>

        {/* Mute toggle */}
        <button onClick={() => setMuted(m => !m)} className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Right rail actions */}
      <div className="absolute right-3 md:right-8 bottom-28 z-30 flex flex-col gap-4 items-center">
        <ActionBtn icon={<Flame className="w-6 h-6 text-brand-orange" />} count={null} onClick={() => toast.success("Streak +1 today")} />
        <ActionBtn icon={<Heart className="w-6 h-6" />} count={current.like_count} onClick={() => like(current.id, !!user)} />
        <ActionBtn icon={<Bookmark className="w-6 h-6" />} count={current.save_count} onClick={() => save(current.id, !!user)} />
        <ActionBtn icon={<Users className="w-6 h-6 text-accent-mint" />} count={null} onClick={() => toast("Join the accountability room from the video page", { icon: "🛡️" })} />
        <ActionBtn icon={<Share2 className="w-6 h-6" />} count={null} onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Link copied"); }} />
      </div>

      {/* Vertical nav */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 hidden md:flex flex-col gap-2">
        <button onClick={prev} className="w-10 h-10 rounded-full bg-bg-card border border-rise flex items-center justify-center hover:bg-bg-surface" disabled={idx === 0}>
          <ChevronUp className="w-5 h-5" />
        </button>
        <button onClick={next} className="w-10 h-10 rounded-full bg-bg-card border border-rise flex items-center justify-center hover:bg-bg-surface" disabled={idx >= data.length - 1}>
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile swipe hints */}
      <div className="md:hidden absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-text-tertiary z-30 flex items-center gap-1">
        <Play className="w-3 h-3" /> Use ↑ ↓ to navigate
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
      <span className="w-12 h-12 rounded-full bg-black/50 backdrop-blur border border-rise flex items-center justify-center hover:bg-bg-card">
        {icon}
      </span>
      {count !== null && <span className="text-xs font-stat font-semibold">{count}</span>}
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
