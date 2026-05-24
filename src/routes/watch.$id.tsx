import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Heart, Bookmark, Share2, ChevronLeft, Eye, Flame } from "lucide-react";
import toast from "react-hot-toast";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/watch/$id")({
  component: WatchPage,
});

function WatchPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();

  const { data: video, isLoading } = useQuery({
    queryKey: ["watch", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*, profiles(username, display_name, avatar_url, creator_tier, follower_count)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // record a view (best-effort)
  useEffect(() => {
    if (!video) return;
    supabase.from("video_views").insert({ video_id: video.id, user_id: user?.id ?? null }).then(() => {});
  }, [video?.id, user?.id]);

  if (isLoading) return <Center>Loading…</Center>;
  if (!video) return <Center>Video not found</Center>;

  const profile: any = Array.isArray(video.profiles) ? video.profiles[0] : video.profiles;

  const like = async () => {
    if (!user) return toast.error("Sign in to like");
    const { error } = await supabase.from("video_likes").insert({ video_id: video.id, user_id: user.id });
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    toast.success("Liked");
  };
  const save = async () => {
    if (!user) return toast.error("Sign in to save");
    const { error } = await supabase.from("video_saves").insert({ video_id: video.id, user_id: user.id });
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    toast.success("Saved");
  };
  const share = async () => {
    const url = window.location.href;
    if ((navigator as any).share) { try { await (navigator as any).share({ title: video.title, url }); return; } catch {} }
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); } catch { toast.error("Could not copy"); }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <button onClick={() => nav({ to: "/feed" })} className="text-sm text-text-secondary hover:text-text-primary inline-flex items-center gap-1 mb-3">
          <ChevronLeft className="w-4 h-4" /> Back to feed
        </button>
        <div className="bg-black rounded-2xl overflow-hidden">
          <video
            src={video.video_url}
            poster={video.thumbnail_url}
            controls
            autoPlay
            playsInline
            className="w-full max-h-[78vh] object-contain bg-black"
          />
        </div>
        <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-brand-purple uppercase font-bold tracking-wide mb-2">{video.category}</span>
            <h1 className="font-display font-black text-2xl uppercase leading-tight">{video.title}</h1>
            {profile && (
              <Link to="/$username" params={{ username: profile.username }} className="mt-2 inline-flex items-center gap-2 group">
                <div className="w-9 h-9 rounded-full bg-bg-surface border border-brand-purple flex items-center justify-center font-bold">
                  {profile.display_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <div className="font-semibold group-hover:text-brand-purple">@{profile.username}</div>
                  <div className="text-xs text-text-tertiary font-stat">{profile.follower_count ?? 0} followers</div>
                </div>
              </Link>
            )}
            <div className="flex gap-4 mt-3 text-sm text-text-tertiary font-stat">
              <span className="inline-flex items-center gap-1"><Eye className="w-4 h-4" /> {video.view_count}</span>
              <span className="inline-flex items-center gap-1"><Heart className="w-4 h-4" /> {video.like_count}</span>
              <span className="inline-flex items-center gap-1"><Bookmark className="w-4 h-4" /> {video.save_count}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={like} className="btn-ghost py-2 px-3 text-sm inline-flex items-center gap-1"><Heart className="w-4 h-4" /> Like</button>
            <button onClick={save} className="btn-ghost py-2 px-3 text-sm inline-flex items-center gap-1"><Bookmark className="w-4 h-4" /> Save</button>
            <button onClick={share} className="btn-ghost py-2 px-3 text-sm inline-flex items-center gap-1"><Share2 className="w-4 h-4" /> Share</button>
            <button onClick={() => toast.success("Streak +1 today")} className="btn-primary py-2 px-3 text-sm inline-flex items-center gap-1"><Flame className="w-4 h-4" /> Streak</button>
          </div>
        </div>
        {video.description && (
          <div className="card-rise p-5 mt-5 whitespace-pre-wrap text-text-secondary">{video.description}</div>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-5xl mx-auto px-6 py-20 text-center text-text-secondary">{children}</div>
    </div>
  );
}
