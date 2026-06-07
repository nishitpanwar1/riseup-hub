import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { BarChart3, Eye, Film, Heart, MessageCircle, Save, Upload, Users, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/studio")({
  ssr: false,
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

function StudioPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);

  const { data } = useQuery({
    queryKey: ["studio", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [profileRes, videosRes, roomsRes, viewsRes] = await Promise.all([
        supabase.from("profiles").select("username, display_name, follower_count, total_views").eq("id", user!.id).maybeSingle(),
        supabase.from("videos").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("accountability_rooms").select("*").eq("creator_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("video_views").select("created_at, seconds_watched, video_id, videos!inner(user_id)").eq("videos.user_id", user!.id).order("created_at", { ascending: false }).limit(500),
      ]);
      if (videosRes.error) throw videosRes.error;
      return { profile: profileRes.data, videos: videosRes.data ?? [], rooms: roomsRes.data ?? [], views: viewsRes.data ?? [] };
    },
  });

  const videos = data?.videos ?? [];
  const totals = videos.reduce((a: any, v: any) => ({
    views: a.views + Number(v.view_count ?? 0), likes: a.likes + (v.like_count ?? 0), saves: a.saves + (v.save_count ?? 0), comments: a.comments + (v.comment_count ?? 0),
  }), { views: 0, likes: 0, saves: 0, comments: 0 });
  const watchHours = ((data?.views ?? []).reduce((sum: number, v: any) => sum + (v.seconds_watched ?? 0), 0) / 3600).toFixed(1);
  const chart = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { day: d.toLocaleDateString(undefined, { weekday: "short" }), views: (data?.views ?? []).filter((v: any) => v.created_at?.slice(0, 10) === key).length };
  });

  const saveEdit = async () => {
    if (!editing) return;
    const tags = String(editing.tagsText ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5);
    const { error } = await supabase.from("videos").update({ title: editing.title, description: editing.description || null, category: editing.category, tags }).eq("id", editing.id).eq("user_id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Video updated");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["studio", user?.id] });
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div><h1 className="text-3xl font-black uppercase">Creator Studio</h1><p className="text-text-secondary">Manage videos, shorts, rooms, streaks and analytics.</p></div>
          <Link to="/studio/upload" className="btn-primary inline-flex items-center gap-2"><Upload className="w-4 h-4" /> Upload</Link>
        </div>
        <section className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <Stat icon={<Film />} label="Videos" value={videos.length} /><Stat icon={<Eye />} label="Views" value={totals.views} /><Stat icon={<Users />} label="Subscribers" value={data?.profile?.follower_count ?? 0} />
          <Stat icon={<BarChart3 />} label="Watch hours" value={watchHours} /><Stat icon={<Heart />} label="Likes" value={totals.likes} /><Stat icon={<MessageCircle />} label="Comments" value={totals.comments} />
        </section>
        <section className="card-rise p-5"><h2 className="text-sm font-black uppercase mb-4">Views · last 7 days</h2><div className="h-48"><ResponsiveContainer><AreaChart data={chart}><XAxis dataKey="day" stroke="#71717A" /><Tooltip contentStyle={{ background: "#141414", border: "1px solid #262626" }} /><Area dataKey="views" stroke="#FF6B35" fill="#FF6B3540" /></AreaChart></ResponsiveContainer></div></section>
        <section className="card-rise overflow-hidden"><div className="p-5 border-b border-rise flex items-center justify-between"><h2 className="font-black uppercase">Content</h2><span className="text-xs text-text-tertiary font-stat">{videos.filter((v: any) => v.is_short).length} shorts · {videos.filter((v: any) => !v.is_short).length} videos</span></div>{videos.map((v: any) => <div key={v.id} className="p-4 border-b border-rise flex gap-4 items-center"><img src={v.thumbnail_url} alt={v.title} className="w-24 aspect-video object-cover rounded-md bg-bg-surface" /><div className="flex-1 min-w-0"><p className="font-bold truncate">{v.title}</p><p className="text-xs text-text-tertiary font-stat">{v.is_short ? "Short" : "Video"} · {v.view_count ?? 0} views · {v.like_count ?? 0} likes · {v.comment_count ?? 0} comments</p></div><button onClick={() => setEditing({ ...v, tagsText: (v.tags ?? []).join(", ") })} className="btn-ghost py-2 px-4 text-sm">Edit</button></div>)}{videos.length === 0 && <p className="p-10 text-center text-text-tertiary">No uploads yet.</p>}</section>
        <section className="card-rise p-5"><h2 className="font-black uppercase mb-3">Rooms Arena</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{(data?.rooms ?? []).map((r: any) => <Link key={r.id} to="/rooms/$id" params={{ id: r.id }} className="bg-bg-surface rounded-xl p-4"><p className="font-bold">{r.title}</p><p className="text-xs text-text-tertiary font-stat">{r.member_count ?? 0} members · {r.challenge_days} days</p></Link>)}{(data?.rooms ?? []).length === 0 && <p className="text-text-tertiary">No rooms created yet.</p>}</div></section>
      </main>
      {editing && <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"><div className="card-rise p-5 w-full max-w-xl space-y-3"><h2 className="font-black uppercase">Edit metadata</h2><input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full px-3 py-2.5" /><textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full px-3 py-2.5 min-h-[90px]" /><select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="w-full px-3 py-2.5">{CATS.map(c => <option key={c} value={c}>{c}</option>)}</select><input value={editing.tagsText} onChange={(e) => setEditing({ ...editing, tagsText: e.target.value })} placeholder="tags, comma, separated" className="w-full px-3 py-2.5" /><div className="flex gap-2 justify-end"><button onClick={() => setEditing(null)} className="btn-ghost py-2 px-4">Cancel</button><button onClick={saveEdit} className="btn-primary py-2 px-4">Save</button></div></div></div>}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactElement; label: string; value: string | number }) {
  return <div className="card-rise p-4"><div className="text-brand-orange w-5 h-5 mb-3">{icon}</div><p className="font-stat text-2xl font-black">{value}</p><p className="text-xs text-text-tertiary uppercase tracking-wider">{label}</p></div>;
}