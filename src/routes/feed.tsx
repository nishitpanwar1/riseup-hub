import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Flame, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
});


const CATEGORIES = ["all", "discipline", "fitness", "study", "entrepreneur", "mindset", "finance", "morning", "sports"] as const;
const PAGE_SIZE = 9;

function FeedPage() {
  const { user } = useAuth();
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("all");
  const [page, setPage] = useState(0);

  const { data: videos, isLoading } = useQuery({
    queryKey: ["feed", cat, page],
    queryFn: async () => {
      let q = supabase
        .from("videos")
        .select("id, title, description, category, video_url, thumbnail_url, duration, like_count, view_count, tags, profiles(username, display_name)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (cat !== "all") q = q.eq("category", cat);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: streak } = useQuery({
    queryKey: ["my-streak", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("streaks").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: leaders } = useQuery({
    queryKey: ["leaders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, total_views, follower_count, creator_tier")
        .order("follower_count", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[220px_1fr_280px] gap-6">
        {/* LEFT: categories */}
        <aside className="card-rise p-4 h-fit lg:sticky lg:top-20">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-3">Focus</h3>
          <div className="flex lg:flex-col gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => { setCat(c); setPage(0); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize text-left ${cat === c ? "bg-brand-purple text-text-primary" : "bg-bg-surface text-text-secondary hover:text-text-primary"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </aside>

        {/* CENTER: feed */}
        <main>
          <h1 className="text-3xl font-black uppercase mb-4">Feed</h1>
          {isLoading ? (
            <div className="text-text-secondary">Loading…</div>
          ) : !videos?.length ? (
            <div className="card-rise p-12 text-center">
              <p className="text-text-secondary">No videos in this category yet.</p>
              <Link to="/studio/upload" className="btn-primary inline-block mt-4">Upload one</Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-5">
              {videos.map((v: any) => <VideoCard key={v.id} video={v} />)}
            </div>
          )}
          <div className="flex justify-center items-center gap-3 mt-8">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-ghost py-2 px-4 text-sm disabled:opacity-30"><ChevronLeft className="w-4 h-4 inline" /> Prev</button>
            <span className="font-stat text-text-secondary">Page {page + 1}</span>
            <button disabled={(videos?.length ?? 0) < PAGE_SIZE} onClick={() => setPage(p => p + 1)} className="btn-ghost py-2 px-4 text-sm disabled:opacity-30">Next <ChevronRight className="w-4 h-4 inline" /></button>
          </div>
        </main>

        {/* RIGHT: streak + leaderboard */}
        <aside className="space-y-4">
          {user && (
            <div className="card-rise p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Your streak</h3>
                <Flame className="w-4 h-4 text-brand-orange" />
              </div>
              <div className="mt-2 font-display font-black text-4xl text-brand-orange font-stat">{streak?.current_streak ?? 0}</div>
              <p className="text-xs text-text-secondary">days · longest {streak?.longest_streak ?? 0}</p>
            </div>
          )}
          <div className="card-rise p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Top operators</h3>
              <Trophy className="w-4 h-4 text-accent-gold" />
            </div>
            <ul className="space-y-2">
              {leaders?.map((l: any, i: number) => (
                <li key={l.username}>
                  <Link to="/$username" params={{ username: l.username }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-surface">
                    <span className="font-stat font-black text-text-tertiary w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">@{l.username}</div>
                      <div className="text-xs text-text-secondary font-stat">{l.follower_count} followers</div>
                    </div>
                  </Link>
                </li>
              ))}
              {!leaders?.length && <li className="text-text-tertiary text-sm">No operators yet.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: any }) {
  return (
    <div className="card-rise overflow-hidden group">
      <div className="relative aspect-video bg-black">
        <video src={video.video_url} poster={video.thumbnail_url} muted loop playsInline
          onMouseEnter={(e) => e.currentTarget.play().catch(()=>{})}
          onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
          className="w-full h-full object-cover" />
        <span className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded bg-black/70 font-stat">
          {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, "0")}
        </span>
        <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-brand-purple uppercase font-bold tracking-wide">{video.category}</span>
      </div>
      <div className="p-4">
        <h3 className="font-bold leading-tight line-clamp-2">{video.title}</h3>
        {video.profiles && (
          <Link to="/$username" params={{ username: video.profiles.username }} className="text-xs text-text-secondary mt-1 block hover:text-text-primary">
            @{video.profiles.username}
          </Link>
        )}
        <div className="flex gap-3 mt-2 text-xs text-text-tertiary font-stat">
          <span>{video.view_count} views</span>
          <span>{video.like_count} likes</span>
        </div>
      </div>
    </div>
  );
}
