import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, CartesianGrid } from "recharts";
import { Flame, BadgeCheck, Eye, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/$username")({
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
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

  // Synthetic weekly chart from streak data
  const chartData = Array.from({ length: 7 }).map((_, i) => ({
    day: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i],
    watch: Math.max(0, Math.round(((streak?.current_streak ?? 0) / 7) + Math.sin(i) * 1.5 + 2)),
  }));

  if (!profile) {
    return <div className="min-h-screen bg-bg-primary"><AppHeader /><div className="p-8 text-text-secondary">Profile not found</div></div>;
  }

  const tierColor = { new: "text-text-tertiary", verified: "text-accent-mint", rising: "text-brand-orange", elite: "text-accent-gold" } as const;

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="card-rise p-6 sm:p-8">
          <div className="flex items-start gap-5 flex-wrap">
            <UserAvatar src={profile.avatar_url} name={profile.display_name ?? profile.username} className="w-20 h-20 text-3xl border-2 border-brand-purple" />
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-black uppercase flex items-center gap-2">
                {profile.display_name}
                <BadgeCheck className={`w-6 h-6 ${tierColor[profile.creator_tier as keyof typeof tierColor]}`} />
              </h1>
              <p className="text-text-secondary">@{profile.username}</p>
              {profile.bio && <p className="mt-2 text-text-primary">{profile.bio}</p>}
              <div className="flex gap-4 mt-4 text-sm font-stat">
                <Stat icon={<Users className="w-4 h-4" />} label="followers" value={profile.follower_count ?? 0} />
                <Stat icon={<Eye className="w-4 h-4" />} label="total views" value={Number(profile.total_views ?? 0)} />
                <Stat icon={<Flame className="w-4 h-4 text-brand-orange" />} label="streak" value={streak?.current_streak ?? 0} />
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="card-rise p-5 mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-3">Watch consistency · last 7 days</h3>
          <div className="h-48">
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6B2F" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#FF6B2F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#4A2D7A" vertical={false} />
                <XAxis dataKey="day" stroke="#7A6D96" />
                <Tooltip contentStyle={{ background: "#2D1155", border: "1px solid #4A2D7A", borderRadius: 8 }} />
                <Area type="monotone" dataKey="watch" stroke="#FF6B2F" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

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

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 font-bold uppercase text-sm ${active ? "text-text-primary border-b-2 border-brand-orange" : "text-text-tertiary hover:text-text-secondary"}`}>{children}</button>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-1.5 text-text-secondary">
      {icon}<span className="font-bold text-text-primary">{value}</span><span className="text-text-tertiary">{label}</span>
    </div>
  );
}
