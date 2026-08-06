import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, CartesianGrid } from "recharts";
import { Flame, BadgeCheck, Eye, Users, ChevronRight, History, Bookmark, PlaySquare, Settings, BarChart3 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/$username")({
  validateSearch: (search: Record<string, unknown>): { view?: "you" } =>
    search.view === "you" ? { view: "you" } : {},
  head: () => ({
    meta: [
      { title: "Creator channel | RiseUp" },
      { name: "description", content: "Watch creator videos, shorts, and activity on RiseUp." },
      { property: "og:title", content: "Creator channel | RiseUp" },
      { property: "og:description", content: "Watch creator videos, shorts, and activity on RiseUp." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"videos" | "saves">("videos");

  const { data: profile } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: videos } = useQuery({
    queryKey: ["profile-videos", profile?.id],
    enabled: !!profile && tab === "videos",
    queryFn: async () => {
      const { data } = await supabase.from("videos").select("*").eq("user_id", profile!.id).eq("status", "active").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: saves } = useQuery({
    queryKey: ["profile-saves", profile?.id],
    enabled: !!profile && tab === "saves" && profile?.id === user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("video_saves").select("video_id, videos(*)").eq("user_id", profile!.id).order("created_at", { ascending: false });
      return (data ?? []).map((s: any) => s.videos).filter(Boolean);
    },
  });

  const { data: streak } = useQuery({
    queryKey: ["profile-streak", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase.from("streaks").select("*").eq("user_id", profile!.id).maybeSingle();
      return data;
    },
  });

  const isOwner = !!user && profile?.id === user.id;
  const { data: library } = useQuery({
    queryKey: ["you-library", user?.id],
    enabled: isOwner,
    queryFn: async () => {
      const [historyRes, savedRes] = await Promise.all([
        supabase.from("video_views").select("video_id, created_at, seconds_watched, videos(id,title,thumbnail_url,is_short,duration)").eq("user_id", user?.id ?? "").order("created_at", { ascending: false }).limit(100),
        supabase.from("video_saves").select("video_id, created_at, videos(id,title,thumbnail_url,is_short,duration)").eq("user_id", user?.id ?? "").order("created_at", { ascending: false }).limit(30),
      ]);
      if (historyRes.error) throw historyRes.error;
      if (savedRes.error) throw savedRes.error;
      return { history: historyRes.data ?? [], saved: savedRes.data ?? [] };
    },
  });

  useEffect(() => {
    if (!isOwner || !user?.id) return;
    const channel = supabase
      .channel(`you-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "video_views", filter: `user_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["you-library", user.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "video_saves", filter: `user_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["you-library", user.id] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["profile", username] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isOwner, qc, user?.id, username]);

  const history = (library?.history ?? []) as any[];
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i));
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const rows = history.filter((row) => { const at = +new Date(row.created_at); return at >= +d && at < +next; });
    return { day: d.toLocaleDateString(undefined, { weekday: "short" }), minutes: Math.round(rows.reduce((sum, row) => sum + Number(row.seconds_watched ?? 0), 0) / 60) };
  });

  if (!profile) {
    return <div className="min-h-screen bg-bg-primary"><AppHeader /><div className="p-8 text-text-secondary">Profile not found</div></div>;
  }

  const tierColor = { new: "text-text-tertiary", verified: "text-accent-mint", rising: "text-brand-orange", elite: "text-accent-gold" } as const;

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 overflow-hidden">
        <div className="card-rise p-5 sm:p-8 overflow-hidden">
          <div className="flex items-center sm:items-start gap-4 sm:gap-5">
            <UserAvatar src={profile.avatar_url} name={profile.display_name || profile.username} className="w-20 h-20 text-3xl border-2 border-brand-purple" />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl font-black flex items-center gap-2 min-w-0">
                <span className="truncate">{profile.display_name || profile.username}</span>
                <BadgeCheck className={`w-6 h-6 ${tierColor[profile.creator_tier as keyof typeof tierColor]}`} />
              </h1>
              <p className="text-sm text-text-secondary truncate">@{profile.username}</p>
              {profile.bio && <p className="mt-2 text-text-primary">{profile.bio}</p>}
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs sm:text-sm font-stat">
                <Stat icon={<Users className="w-4 h-4" />} label="followers" value={profile.follower_count ?? 0} />
                <Stat icon={<Eye className="w-4 h-4" />} label="total views" value={Number(profile.total_views ?? 0)} />
                <Stat icon={<Flame className="w-4 h-4 text-brand-orange" />} label="streak" value={streak?.current_streak ?? 0} />
              </div>
            </div>
          </div>
        </div>

        {isOwner && (
          <>
            <section className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <QuickLink to="/studio" icon={<BarChart3 />} label="Studio" />
              <QuickLink to="/feed" search={{ view: "history" }} icon={<History />} label="History" />
              <QuickLink to="/feed" search={{ view: "later" }} icon={<Bookmark />} label="Saved" />
              <QuickLink to="/settings" icon={<Settings />} label="Settings" />
            </section>
            <MediaRail title="History" rows={history} empty="Videos you watch will appear here." />
            <MediaRail title="Saved" rows={(library?.saved ?? []) as any[]} empty="Your saved videos will appear here." />
          </>
        )}

        {isOwner && <div className="card-rise p-5 mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-3">Real watch time · last 7 days</h3>
          <div className="h-48">
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-brand-orange)" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="var(--color-brand-orange)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border-rise)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--color-text-tertiary)" />
                <Tooltip contentStyle={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-rise)", borderRadius: 8 }} formatter={(value) => [`${value} min`, "Watch time"]} />
                <Area type="monotone" dataKey="minutes" stroke="var(--color-brand-orange)" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>}

        {/* Tabs */}
        <div className="mt-6 flex gap-2 border-b border-rise">
          <TabBtn active={tab==="videos"} onClick={() => setTab("videos")}>Videos</TabBtn>
          {profile.id === user?.id && <TabBtn active={tab==="saves"} onClick={() => setTab("saves")}>Saved</TabBtn>}
        </div>

        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(tab === "videos" ? videos : saves)?.map((v: any) => (
            <Link key={v.id} to="/shorts" className="card-rise overflow-hidden block">
              <div className="aspect-video bg-black relative">
                <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
              </div>
              <div className="p-3">
                <h4 className="font-bold text-sm line-clamp-2">{v.title}</h4>
              </div>
            </Link>
          )) ?? null}
          {((tab === "videos" ? videos : saves)?.length ?? 0) === 0 && (
            <p className="text-text-tertiary col-span-full text-center py-8">Nothing here yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickLink({ to, search, icon, label }: { to: string; search?: Record<string, string>; icon: React.ReactNode; label: string }) {
  return <Link to={to as any} search={search as any} className="card-rise p-3 flex items-center gap-3 text-sm font-bold hover:border-brand-orange">{icon}<span>{label}</span></Link>;
}

function MediaRail({ title, rows, empty }: { title: string; rows: any[]; empty: string }) {
  const unique = rows.filter((row, index) => row.videos && rows.findIndex((candidate) => candidate.video_id === row.video_id) === index).slice(0, 10);
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black">{title}</h2><ChevronRight className="w-5 h-5 text-text-tertiary" /></div>
      {unique.length ? <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">{unique.map((row) => {
        const video = Array.isArray(row.videos) ? row.videos[0] : row.videos;
        const to = video?.is_short ? "/shorts" : "/watch/$id";
        return <Link key={`${title}-${row.video_id}`} to={to as any} params={(video?.is_short ? undefined : { id: row.video_id }) as any} className="w-44 shrink-0">
          <div className="aspect-video rounded-lg overflow-hidden bg-bg-surface relative"><img src={video?.thumbnail_url} alt={video?.title ?? "Video"} className="w-full h-full object-cover" /><PlaySquare className="absolute bottom-2 right-2 w-4 h-4" /></div>
          <p className="mt-2 text-sm font-semibold line-clamp-2">{video?.title}</p>
        </Link>;
      })}</div> : <p className="text-sm text-text-tertiary py-4">{empty}</p>}
    </section>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 font-bold uppercase text-sm ${active ? "text-text-primary border-b-2 border-brand-orange" : "text-text-tertiary hover:text-text-secondary"}`}>{children}</button>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="min-w-0 text-text-secondary text-center sm:text-left">
      <div className="flex items-center justify-center sm:justify-start gap-1">{icon}<span className="font-bold text-text-primary">{value}</span></div>
      <span className="block text-text-tertiary truncate">{label}</span>
    </div>
  );
}
