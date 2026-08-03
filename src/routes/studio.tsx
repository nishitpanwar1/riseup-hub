import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  BarChart3, Eye, Film, Heart, MessageCircle, Upload, Users, Trash2, LayoutDashboard,
  Clapperboard, UserCog, Camera, Clock, TrendingUp, Send, ShoppingBag, Zap, Bookmark,
} from "lucide-react";
import toast from "react-hot-toast";
import { AppHeader } from "@/components/AppHeader";
import { BackButton } from "@/components/BackButton";
import { MobileTabBar } from "@/components/MobileTabBar";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";

type TabId = "overview" | "content" | "insights" | "comments" | "rooms" | "channel";
type Search = { tab?: TabId };

const TAB_IDS: TabId[] = ["overview", "content", "insights", "comments", "rooms", "channel"];

export const Route = createFileRoute("/studio")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => {
    const t = s.tab as TabId;
    return { tab: TAB_IDS.includes(t) ? t : "overview" };
  },
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: StudioShell,
});

const CATS = ["discipline", "fitness", "study", "entrepreneur", "mindset", "finance", "morning", "sports"];

function StudioShell() {
  const routerState = useRouterState();
  if (routerState.location.pathname !== "/studio") return <Outlet />;
  return <StudioPage />;
}

const TABS = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "content", label: "Content", icon: Clapperboard },
  { id: "insights", label: "Insights", icon: TrendingUp },
  { id: "comments", label: "Comments", icon: MessageCircle },
  { id: "rooms", label: "Rooms", icon: Users },
  { id: "channel", label: "Channel", icon: UserCog },
] as const;

function StudioPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const tab = search.tab ?? "overview";

  // Realtime: keep every studio surface live for my own content
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`studio-rt-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "videos", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["studio-content", user.id] });
        qc.invalidateQueries({ queryKey: ["studio-overview", user.id] });
        qc.invalidateQueries({ queryKey: ["studio-insights", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "video_comments" }, () => {
        qc.invalidateQueries({ queryKey: ["studio-comments", user.id] });
        qc.invalidateQueries({ queryKey: ["studio-overview", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "video_views" }, () => {
        qc.invalidateQueries({ queryKey: ["studio-overview", user.id] });
        qc.invalidateQueries({ queryKey: ["studio-insights", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-safe-nav lg:pb-8">
        <div className="hidden lg:block"><BackButton label="Back" /></div>

        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black uppercase truncate">RiseUp Studio</h1>
            <p className="text-sm text-text-secondary truncate">Manage videos, shorts, rooms and your channel.</p>
          </div>
          <Link to="/studio/upload" className="btn-primary inline-flex items-center gap-2 py-2.5 px-4 text-sm shrink-0">
            <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Upload</span>
          </Link>
        </header>

        <nav className="card-rise p-1 flex gap-1 overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-1">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <Link key={t.id} to="/studio" search={{ tab: t.id }} replace
                className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wide transition-colors ${active ? "bg-brand-orange text-white" : "text-text-secondary hover:bg-bg-surface"}`}>
                <Icon className="w-4 h-4 shrink-0" /> {t.label}
              </Link>
            );
          })}
        </nav>

        {user && tab === "overview" && <OverviewTab userId={user.id} />}
        {user && tab === "content" && <ContentTab userId={user.id} />}
        {user && tab === "insights" && <InsightsTab userId={user.id} />}
        {user && tab === "comments" && <CommentsTab userId={user.id} />}
        {user && tab === "rooms" && <RoomsTab userId={user.id} />}
        {tab === "channel" && <ChannelTab />}
      </main>
      <MobileTabBar />
    </div>
  );
}

/* ------------------------------- DASHBOARD ------------------------------- */

function OverviewTab({ userId }: { userId: string }) {
  const { data: profile } = useMyProfile();
  const { data } = useQuery({
    queryKey: ["studio-overview", userId],
    queryFn: async () => {
      const [videosRes, viewsRes, tokensRes] = await Promise.all([
        supabase.from("videos").select("id, title, thumbnail_url, view_count, like_count, comment_count, save_count, is_short, created_at").eq("user_id", userId),
        supabase.from("video_views").select("created_at, seconds_watched, videos!inner(user_id)").eq("videos.user_id", userId).order("created_at", { ascending: false }).limit(1000),
        supabase.from("user_tokens").select("balance, total_earned").eq("user_id", userId).maybeSingle(),
      ]);
      return { videos: videosRes.data ?? [], views: viewsRes.data ?? [], tokens: tokensRes.data };
    },
  });
  const videos = (data?.videos ?? []) as any[];
  const totals = videos.reduce((a: any, v: any) => ({
    views: a.views + Number(v.view_count ?? 0), likes: a.likes + (v.like_count ?? 0), saves: a.saves + (v.save_count ?? 0), comments: a.comments + (v.comment_count ?? 0),
  }), { views: 0, likes: 0, saves: 0, comments: 0 });
  const watchHours = ((data?.views ?? []).reduce((sum: number, v: any) => sum + (v.seconds_watched ?? 0), 0) / 3600).toFixed(1);
  const chart = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { day: d.toLocaleDateString(undefined, { weekday: "short" }), views: (data?.views ?? []).filter((v: any) => v.created_at?.slice(0, 10) === key).length };
  });
  const latest = [...videos].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];

  return (
    <>
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3">
        <Stat icon={<Film />} label="Videos" value={videos.length} />
        <Stat icon={<Eye />} label="Views" value={formatK(totals.views)} />
        <Stat icon={<Users />} label="Subscribers" value={formatK(profile?.follower_count ?? 0)} />
        <Stat icon={<Clock />} label="Watch hours" value={watchHours} />
        <Stat icon={<Heart />} label="Likes" value={formatK(totals.likes)} />
        <Stat icon={<Zap />} label="Tokens" value={formatK(data?.tokens?.balance ?? 0)} />
      </section>

      {latest && (
        <section className="card-rise p-4 sm:p-5">
          <h2 className="text-xs font-black uppercase tracking-wider text-text-tertiary mb-3">Latest upload performance</h2>
          <div className="flex gap-4 items-center">
            <img src={latest.thumbnail_url} alt={latest.title} className="w-28 aspect-video object-cover rounded-lg bg-bg-surface shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold truncate">{latest.title}</p>
              <p className="text-xs text-text-tertiary font-stat mt-1">
                {formatK(latest.view_count ?? 0)} views · {latest.like_count ?? 0} likes · {latest.comment_count ?? 0} comments
              </p>
              <Link to="/studio" search={{ tab: "insights" }} className="text-xs font-bold uppercase tracking-wider text-brand-orange mt-2 inline-block">See insights →</Link>
            </div>
          </div>
        </section>
      )}

      <section className="card-rise p-4 sm:p-5">
        <h2 className="text-xs font-black uppercase tracking-wider text-text-tertiary mb-4">Views · last 7 days</h2>
        <div className="h-44 sm:h-48">
          <ResponsiveContainer>
            <AreaChart data={chart}>
              <XAxis dataKey="day" stroke="#71717A" fontSize={11} />
              <Tooltip contentStyle={{ background: "#141414", border: "1px solid #262626", borderRadius: 12 }} />
              <Area dataKey="views" stroke="#FF6B35" fill="#FF6B3540" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-3">
        <QuickCard to="/studio/upload" icon={<Upload className="w-5 h-5" />} title="Upload" sub="Short or long form" />
        <QuickCard to="/studio/shop" icon={<ShoppingBag className="w-5 h-5" />} title="Products" sub="Sell for money or tokens" />
        <QuickCard to="/rooms" icon={<Users className="w-5 h-5" />} title="Rooms" sub="Run a challenge" />
      </section>
    </>
  );
}

function QuickCard({ to, icon, title, sub }: { to: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Link to={to as any} className="card-rise p-4 flex items-center gap-3 hover:border-brand-orange transition-colors">
      <span className="text-brand-orange shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold text-sm truncate">{title}</span>
        <span className="block text-xs text-text-tertiary truncate">{sub}</span>
      </span>
    </Link>
  );
}

/* -------------------------------- CONTENT -------------------------------- */

function ContentTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [filter, setFilter] = useState<"all" | "short" | "long">("all");
  const { data: videos = [] } = useQuery({
    queryKey: ["studio-content", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("videos").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const shown = (videos as any[]).filter(v => filter === "all" || (filter === "short" ? v.is_short : !v.is_short));

  const saveEdit = async () => {
    if (!editing) return;
    const tags = String(editing.tagsText ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5);
    const { error } = await supabase.from("videos").update({ title: editing.title, description: editing.description || null, category: editing.category, tags }).eq("id", editing.id).eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success("Video updated");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["studio-content", userId] });
  };

  const deleteVideo = async (v: any) => {
    if (!confirm(`Delete "${v.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("videos").delete().eq("id", v.id).eq("user_id", userId);
    if (error) return toast.error(error.message);
    try {
      const url = v.video_url as string;
      const marker = "/storage/v1/object/public/videos/";
      const idx = url.indexOf(marker);
      if (idx !== -1) await supabase.storage.from("videos").remove([url.slice(idx + marker.length)]);
    } catch { /* storage cleanup is best-effort */ }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["studio-content", userId] });
  };

  return (
    <section className="card-rise overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-rise flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-black uppercase text-sm">Content</h2>
        <div className="flex gap-1">
          {(["all", "short", "long"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase ${filter === f ? "bg-bg-surface text-text-primary" : "text-text-tertiary"}`}>
              {f === "all" ? "All" : f === "short" ? "Shorts" : "Videos"}
            </button>
          ))}
        </div>
      </div>
      {shown.map((v: any) => (
        <div key={v.id} className="p-3 sm:p-4 border-b border-rise flex gap-3 sm:gap-4 items-center">
          <img src={v.thumbnail_url} alt={v.title} className="w-20 sm:w-24 aspect-video object-cover rounded-md bg-bg-surface shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate text-sm">{v.title}</p>
            <p className="text-[11px] text-text-tertiary font-stat truncate">{v.is_short ? "Short" : "Video"} · {formatK(v.view_count ?? 0)} views · {v.like_count ?? 0} likes · {v.comment_count ?? 0} comments</p>
          </div>
          <button onClick={() => setEditing({ ...v, tagsText: (v.tags ?? []).join(", ") })} className="btn-ghost py-1.5 px-3 text-xs shrink-0">Edit</button>
          <button onClick={() => deleteVideo(v)} className="p-2 text-text-tertiary hover:text-accent-red shrink-0" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      {shown.length === 0 && <p className="p-10 text-center text-text-tertiary text-sm">Nothing here yet.</p>}
      {editing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="card-rise p-5 w-full sm:max-w-xl space-y-3 rounded-b-none sm:rounded-2xl">
            <h2 className="font-black uppercase text-sm">Edit metadata</h2>
            <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full px-3 py-2.5" />
            <textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full px-3 py-2.5 min-h-[90px]" />
            <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="w-full px-3 py-2.5">{CATS.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <input value={editing.tagsText} onChange={(e) => setEditing({ ...editing, tagsText: e.target.value })} placeholder="tags, comma, separated" className="w-full px-3 py-2.5" />
            <div className="flex gap-2 justify-end pb-[env(safe-area-inset-bottom)]">
              <button onClick={() => setEditing(null)} className="btn-ghost py-2 px-4">Cancel</button>
              <button onClick={saveEdit} className="btn-primary py-2 px-4">Save</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* -------------------------------- INSIGHTS -------------------------------- */

function InsightsTab({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["studio-insights", userId],
    queryFn: async () => {
      const [videosRes, viewsRes] = await Promise.all([
        supabase.from("videos").select("id, title, thumbnail_url, is_short, duration, view_count, like_count, comment_count, save_count, created_at").eq("user_id", userId),
        supabase.from("video_views").select("video_id, created_at, seconds_watched, total_seconds, completion_rate, videos!inner(user_id)").eq("videos.user_id", userId).order("created_at", { ascending: false }).limit(2000),
      ]);
      return { videos: videosRes.data ?? [], views: viewsRes.data ?? [] };
    },
  });

  const videos = (data?.videos ?? []) as any[];
  const views = (data?.views ?? []) as any[];

  const perVideo = useMemo(() => {
    const map = new Map<string, { secs: number; n: number; comp: number }>();
    views.forEach(v => {
      const cur = map.get(v.video_id) ?? { secs: 0, n: 0, comp: 0 };
      map.set(v.video_id, { secs: cur.secs + (v.seconds_watched ?? 0), n: cur.n + 1, comp: cur.comp + (v.completion_rate ?? 0) });
    });
    return videos.map(v => {
      const s = map.get(v.id) ?? { secs: 0, n: 0, comp: 0 };
      const engagement = (v.view_count ?? 0) > 0 ? (((v.like_count ?? 0) + (v.comment_count ?? 0) + (v.save_count ?? 0)) / Number(v.view_count)) * 100 : 0;
      return {
        ...v,
        watchMinutes: s.secs / 60,
        avgViewSec: s.n ? s.secs / s.n : 0,
        retention: s.n ? (s.comp / s.n) * 100 : 0,
        engagement,
      };
    }).sort((a, b) => Number(b.view_count ?? 0) - Number(a.view_count ?? 0));
  }, [videos, views]);

  const chart28 = useMemo(() => Array.from({ length: 28 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (27 - i));
    const key = d.toISOString().slice(0, 10);
    const day = views.filter(v => v.created_at?.slice(0, 10) === key);
    return { day: d.getDate().toString(), views: day.length, minutes: Math.round(day.reduce((s, v) => s + (v.seconds_watched ?? 0), 0) / 60) };
  }), [views]);

  const totalMinutes = Math.round(views.reduce((s, v) => s + (v.seconds_watched ?? 0), 0) / 60);
  const avgRetention = views.length ? (views.reduce((s, v) => s + (v.completion_rate ?? 0), 0) / views.length) * 100 : 0;

  return (
    <>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Stat icon={<Eye />} label="Views (tracked)" value={formatK(views.length)} />
        <Stat icon={<Clock />} label="Watch minutes" value={formatK(totalMinutes)} />
        <Stat icon={<TrendingUp />} label="Avg retention" value={`${avgRetention.toFixed(0)}%`} />
        <Stat icon={<Bookmark />} label="Uploads" value={videos.length} />
      </section>

      <section className="card-rise p-4 sm:p-5">
        <h2 className="text-xs font-black uppercase tracking-wider text-text-tertiary mb-4">Views &amp; watch time · last 28 days</h2>
        <div className="h-52">
          <ResponsiveContainer>
            <AreaChart data={chart28}>
              <XAxis dataKey="day" stroke="#71717A" fontSize={10} interval={3} />
              <Tooltip contentStyle={{ background: "#141414", border: "1px solid #262626", borderRadius: 12 }} />
              <Area dataKey="views" stroke="#FF6B35" fill="#FF6B3530" />
              <Area dataKey="minutes" stroke="#7B6BFF" fill="#7B6BFF30" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card-rise overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-rise">
          <h2 className="font-black uppercase text-sm">Per-video insights</h2>
        </div>
        {perVideo.map(v => (
          <div key={v.id} className="p-3 sm:p-4 border-b border-rise">
            <div className="flex gap-3 items-center">
              <img src={v.thumbnail_url} alt={v.title} className="w-16 sm:w-20 aspect-video object-cover rounded-md bg-bg-surface shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate">{v.title}</p>
                <p className="text-[11px] text-text-tertiary font-stat">{v.is_short ? "Short" : "Video"} · {timeAgo(v.created_at)}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <Mini label="Views" value={formatK(v.view_count ?? 0)} />
              <Mini label="Watch min" value={v.watchMinutes.toFixed(1)} />
              <Mini label="Avg view" value={`${v.avgViewSec.toFixed(0)}s`} />
              <Mini label="Retention" value={`${v.retention.toFixed(0)}%`} />
              <Mini label="Engagement" value={`${v.engagement.toFixed(1)}%`} />
            </div>
          </div>
        ))}
        {perVideo.length === 0 && <p className="p-10 text-center text-text-tertiary text-sm">No uploads to analyse yet.</p>}
      </section>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-bg-surface py-2 px-1">
      <p className="font-stat font-black text-sm">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p>
    </div>
  );
}

/* -------------------------------- COMMENTS -------------------------------- */

function CommentsTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: comments = [] } = useQuery({
    queryKey: ["studio-comments", userId],
    queryFn: async () => {
      const { data: mine } = await supabase.from("videos").select("id, title, thumbnail_url").eq("user_id", userId);
      const ids = (mine ?? []).map((v: any) => v.id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("video_comments")
        .select("id, body, created_at, video_id, user_id, profiles(username, display_name, avatar_url)")
        .in("video_id", ids)
        .order("created_at", { ascending: false })
        .limit(200);
      const titles = new Map((mine ?? []).map((v: any) => [v.id, v]));
      return (data ?? []).map((c: any) => ({ ...c, video: titles.get(c.video_id) }));
    },
  });

  const sendReply = async (videoId: string, handle?: string) => {
    const body = replyText.trim();
    if (!body) return;
    const { error } = await supabase.from("video_comments").insert({
      video_id: videoId, user_id: userId, body: handle ? `@${handle} ${body}` : body,
    });
    if (error) return toast.error(error.message);
    setReplyText(""); setReplyTo(null);
    qc.invalidateQueries({ queryKey: ["studio-comments", userId] });
  };

  const removeComment = async (id: string) => {
    const { error } = await supabase.from("video_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Comment removed");
    qc.invalidateQueries({ queryKey: ["studio-comments", userId] });
  };

  return (
    <section className="card-rise overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-rise flex items-center justify-between">
        <h2 className="font-black uppercase text-sm">Comments</h2>
        <span className="text-xs text-text-tertiary font-stat">{comments.length} total</span>
      </div>
      {(comments as any[]).map((c: any) => {
        const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        return (
          <div key={c.id} className="p-4 border-b border-rise">
            <div className="flex gap-3">
              <UserAvatar src={p?.avatar_url} name={p?.display_name ?? p?.username} className="w-8 h-8" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-text-tertiary font-stat truncate">@{p?.username ?? "user"} · {timeAgo(c.created_at)}</p>
                <p className="text-sm mt-0.5 break-words">{c.body}</p>
                <p className="text-[11px] text-text-tertiary mt-1 truncate">on “{c.video?.title ?? "video"}”</p>
                <div className="mt-2 flex gap-3">
                  <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(""); }} className="text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary">Reply</button>
                  <button onClick={() => removeComment(c.id)} className="text-xs font-bold uppercase tracking-wider text-text-tertiary hover:text-accent-red">Remove</button>
                </div>
                {replyTo === c.id && (
                  <div className="mt-2 flex gap-2">
                    <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…" className="flex-1 px-3 py-2 text-sm" />
                    <button onClick={() => sendReply(c.video_id, p?.username)} className="btn-primary py-2 px-3 shrink-0"><Send className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {comments.length === 0 && <p className="p-10 text-center text-text-tertiary text-sm">No comments yet.</p>}
    </section>
  );
}

/* --------------------------------- ROOMS --------------------------------- */

function RoomsTab({ userId }: { userId: string }) {
  const { data: rooms = [] } = useQuery({
    queryKey: ["studio-rooms", userId],
    queryFn: async () => {
      const { data } = await supabase.from("accountability_rooms").select("*").eq("creator_id", userId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <section className="card-rise p-4 sm:p-5">
      <h2 className="font-black uppercase text-sm mb-3">Rooms Arena</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(rooms as any[]).map((r: any) => (
          <Link key={r.id} to="/rooms/$id" params={{ id: r.id }} className="bg-bg-surface rounded-xl p-4">
            <p className="font-bold truncate">{r.title}</p>
            <p className="text-xs text-text-tertiary font-stat">{r.member_count ?? 0} members · {r.challenge_days} days</p>
          </Link>
        ))}
        {rooms.length === 0 && <p className="text-text-tertiary text-sm">No rooms created yet.</p>}
      </div>
    </section>
  );
}

/* -------------------------------- CHANNEL -------------------------------- */

function ChannelTab() {
  const { user } = useAuth();
  const { data: profile, invalidate } = useMyProfile();

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setHandle(profile.username ?? "");
    setBio(profile.bio ?? "");
    setCats(profile.category_focus ?? []);
  }, [profile]);

  const uploadAvatar = async (f: File | null) => {
    if (!f || !user) return;
    setUploading(true);
    try {
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true, contentType: f.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: upErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
      if (upErr) throw upErr;
      await invalidate();
      toast.success("Profile picture updated");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleanHandle.length < 3) return toast.error("Handle must be 3+ chars (a-z, 0-9, _)");
    setSaving(true);
    try {
      if (cleanHandle !== profile?.username) {
        const { data: taken } = await supabase.from("profiles").select("id").eq("username", cleanHandle).maybeSingle();
        if (taken && taken.id !== user.id) throw new Error("Handle already taken");
      }
      const { error } = await supabase.from("profiles").update({
        display_name: displayName.trim() || cleanHandle,
        username: cleanHandle,
        bio: bio.trim() || null,
        category_focus: cats,
      }).eq("id", user.id);
      if (error) throw error;
      await invalidate();
      toast.success("Channel updated");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card-rise p-4 sm:p-6 max-w-3xl">
      <h2 className="text-lg sm:text-xl font-black uppercase mb-5 flex items-center gap-2"><UserCog className="w-5 h-5" /> Channel settings</h2>

      <div className="flex items-center gap-4 sm:gap-5 mb-6">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-brand-purple flex items-center justify-center font-black text-2xl shrink-0">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" key={profile.avatar_url} />
          ) : (
            (profile?.username || "U").slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold truncate">@{profile?.username}</p>
          <p className="text-xs text-text-tertiary mb-2">JPG/PNG, up to ~5 MB</p>
          <label className="btn-ghost py-1.5 px-3 text-xs cursor-pointer inline-flex items-center gap-1.5 relative">
            <Camera className="w-3.5 h-3.5" />
            <input type="file" accept="image/*" onChange={e => uploadAvatar(e.target.files?.[0] ?? null)} className="absolute inset-0 opacity-0 cursor-pointer" />
            {uploading ? "Uploading…" : "Change photo"}
          </label>
        </div>
      </div>

      <Field label="Channel name">
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={40} className="w-full px-3 py-2.5" placeholder="Your display name" />
      </Field>
      <Field label="Handle (username)">
        <div className="flex items-center">
          <span className="px-3 py-2.5 bg-bg-surface border border-rise border-r-0 rounded-l-md text-text-tertiary font-mono">@</span>
          <input value={handle} onChange={e => setHandle(e.target.value)} maxLength={24} className="flex-1 min-w-0 px-3 py-2.5 rounded-l-none font-mono" placeholder="handle" />
        </div>
        <p className="text-xs text-text-tertiary mt-1">Lowercase letters, numbers, underscores. Min 3 chars.</p>
      </Field>
      <Field label="Bio">
        <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={300} className="w-full px-3 py-2.5 min-h-[90px]" placeholder="Tell people what your channel is about" />
      </Field>
      <Field label="Focus categories">
        <div className="flex flex-wrap gap-2">
          {CATS.map(c => {
            const active = cats.includes(c);
            return (
              <button key={c} type="button" onClick={() => setCats(active ? cats.filter(x => x !== c) : [...cats, c])}
                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase ${active ? "bg-brand-orange text-white" : "bg-bg-surface text-text-secondary"}`}>
                {c}
              </button>
            );
          })}
        </div>
      </Field>

      <button onClick={save} disabled={saving} className="btn-primary mt-2 w-full sm:w-auto">{saving ? "Saving…" : "Save changes"}</button>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="text-xs uppercase tracking-wide text-text-secondary font-semibold">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactElement; label: string; value: string | number }) {
  return (
    <div className="card-rise p-3 sm:p-4">
      <div className="text-brand-orange w-5 h-5 mb-2 sm:mb-3">{icon}</div>
      <p className="font-stat text-xl sm:text-2xl font-black">{value}</p>
      <p className="text-[10px] sm:text-xs text-text-tertiary uppercase tracking-wider truncate">{label}</p>
    </div>
  );
}

function formatK(n: number) {
  const v = Number(n ?? 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return `${v}`;
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export { BarChart3 };
