import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { BarChart3, Eye, Film, Heart, MessageCircle, Upload, Users, Trash2, LayoutDashboard, Clapperboard, UserCog, Camera } from "lucide-react";
import toast from "react-hot-toast";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";

type Search = { tab?: "overview" | "content" | "rooms" | "channel" };

export const Route = createFileRoute("/studio")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => {
    const t = s.tab;
    return { tab: t === "content" || t === "rooms" || t === "channel" ? t : "overview" };
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
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "content", label: "Content", icon: Clapperboard },
  { id: "rooms", label: "Rooms", icon: Users },
  { id: "channel", label: "Channel", icon: UserCog },
] as const;

function StudioPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const tab = search.tab ?? "overview";

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-black uppercase">Creator Studio</h1>
            <p className="text-text-secondary">Manage videos, shorts, rooms and your channel.</p>
          </div>
          <Link to="/studio/upload" className="btn-primary inline-flex items-center gap-2"><Upload className="w-4 h-4" /> Upload</Link>
        </div>

        <nav className="card-rise p-1 flex flex-wrap gap-1 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <Link key={t.id} to="/studio" search={{ tab: t.id }} replace
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-colors ${active ? "bg-brand-orange text-white" : "text-text-secondary hover:bg-bg-surface"}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </Link>
            );
          })}
        </nav>

        {tab === "overview" && user && <OverviewTab userId={user.id} />}
        {tab === "content" && user && <ContentTab userId={user.id} />}
        {tab === "rooms" && user && <RoomsTab userId={user.id} />}
        {tab === "channel" && <ChannelTab />}
      </main>
    </div>
  );
}

function OverviewTab({ userId }: { userId: string }) {
  const { data: profile } = useMyProfile();
  const { data } = useQuery({
    queryKey: ["studio-overview", userId],
    queryFn: async () => {
      const [videosRes, viewsRes] = await Promise.all([
        supabase.from("videos").select("view_count, like_count, comment_count, save_count, is_short").eq("user_id", userId),
        supabase.from("video_views").select("created_at, seconds_watched, videos!inner(user_id)").eq("videos.user_id", userId).order("created_at", { ascending: false }).limit(500),
      ]);
      return { videos: videosRes.data ?? [], views: viewsRes.data ?? [] };
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

  return (
    <>
      <section className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat icon={<Film />} label="Videos" value={videos.length} />
        <Stat icon={<Eye />} label="Views" value={totals.views} />
        <Stat icon={<Users />} label="Subscribers" value={profile?.follower_count ?? 0} />
        <Stat icon={<BarChart3 />} label="Watch hours" value={watchHours} />
        <Stat icon={<Heart />} label="Likes" value={totals.likes} />
        <Stat icon={<MessageCircle />} label="Comments" value={totals.comments} />
      </section>
      <section className="card-rise p-5">
        <h2 className="text-sm font-black uppercase mb-4">Views · last 7 days</h2>
        <div className="h-48">
          <ResponsiveContainer><AreaChart data={chart}><XAxis dataKey="day" stroke="#71717A" /><Tooltip contentStyle={{ background: "#141414", border: "1px solid #262626" }} /><Area dataKey="views" stroke="#FF6B35" fill="#FF6B3540" /></AreaChart></ResponsiveContainer>
        </div>
      </section>
    </>
  );
}

function ContentTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const { data: videos = [] } = useQuery({
    queryKey: ["studio-content", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("videos").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

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
    } catch {}
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["studio-content", userId] });
  };

  return (
    <section className="card-rise overflow-hidden">
      <div className="p-5 border-b border-rise flex items-center justify-between">
        <h2 className="font-black uppercase">Content</h2>
        <span className="text-xs text-text-tertiary font-stat">{videos.filter((v: any) => v.is_short).length} shorts · {videos.filter((v: any) => !v.is_short).length} videos</span>
      </div>
      {videos.map((v: any) => (
        <div key={v.id} className="p-4 border-b border-rise flex gap-4 items-center">
          <img src={v.thumbnail_url} alt={v.title} className="w-24 aspect-video object-cover rounded-md bg-bg-surface" />
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{v.title}</p>
            <p className="text-xs text-text-tertiary font-stat">{v.is_short ? "Short" : "Video"} · {v.view_count ?? 0} views · {v.like_count ?? 0} likes · {v.comment_count ?? 0} comments</p>
          </div>
          <button onClick={() => setEditing({ ...v, tagsText: (v.tags ?? []).join(", ") })} className="btn-ghost py-2 px-4 text-sm">Edit</button>
          <button onClick={() => deleteVideo(v)} className="p-2 text-text-tertiary hover:text-accent-red" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      {videos.length === 0 && <p className="p-10 text-center text-text-tertiary">No uploads yet.</p>}
      {editing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card-rise p-5 w-full max-w-xl space-y-3">
            <h2 className="font-black uppercase">Edit metadata</h2>
            <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full px-3 py-2.5" />
            <textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full px-3 py-2.5 min-h-[90px]" />
            <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="w-full px-3 py-2.5">{CATS.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <input value={editing.tagsText} onChange={(e) => setEditing({ ...editing, tagsText: e.target.value })} placeholder="tags, comma, separated" className="w-full px-3 py-2.5" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="btn-ghost py-2 px-4">Cancel</button>
              <button onClick={saveEdit} className="btn-primary py-2 px-4">Save</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function RoomsTab({ userId }: { userId: string }) {
  const { data: rooms = [] } = useQuery({
    queryKey: ["studio-rooms", userId],
    queryFn: async () => {
      const { data } = await supabase.from("accountability_rooms").select("*").eq("creator_id", userId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <section className="card-rise p-5">
      <h2 className="font-black uppercase mb-3">Rooms Arena</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rooms.map((r: any) => (
          <Link key={r.id} to="/rooms/$id" params={{ id: r.id }} className="bg-bg-surface rounded-xl p-4">
            <p className="font-bold">{r.title}</p>
            <p className="text-xs text-text-tertiary font-stat">{r.member_count ?? 0} members · {r.challenge_days} days</p>
          </Link>
        ))}
        {rooms.length === 0 && <p className="text-text-tertiary">No rooms created yet.</p>}
      </div>
    </section>
  );
}

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
      // uniqueness check if changed
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
    <section className="card-rise p-6 max-w-3xl">
      <h2 className="text-xl font-black uppercase mb-5 flex items-center gap-2"><UserCog className="w-5 h-5" /> Channel Settings</h2>

      <div className="flex items-center gap-5 mb-6">
        <div className="relative w-24 h-24 rounded-full overflow-hidden bg-brand-purple flex items-center justify-center font-black text-2xl shrink-0">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" key={profile.avatar_url} />
          ) : (
            (profile?.username || "U").slice(0, 2).toUpperCase()
          )}
        </div>
        <div>
          <p className="font-bold">@{profile?.username}</p>
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
          <input value={handle} onChange={e => setHandle(e.target.value)} maxLength={24} className="flex-1 px-3 py-2.5 rounded-l-none font-mono" placeholder="handle" />
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

      <button onClick={save} disabled={saving} className="btn-primary mt-2">{saving ? "Saving…" : "Save changes"}</button>
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
  return <div className="card-rise p-4"><div className="text-brand-orange w-5 h-5 mb-3">{icon}</div><p className="font-stat text-2xl font-black">{value}</p><p className="text-xs text-text-tertiary uppercase tracking-wider">{label}</p></div>;
}
