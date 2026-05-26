import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Settings as SettingsIcon, User as UserIcon, Bell, Eye, LogOut } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: SettingsPage,
});

const CATS = ["Discipline","Fitness","Study","Entrepreneur","Mindset","Finance","Morning","Sports"];
const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "focus", label: "Focus Mode", icon: Eye },
] as const;

function SettingsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [section, setSection] = useState<"profile"|"notifications"|"focus">("profile");

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // notif prefs (local only — UI for now)
  const [prefs, setPrefs] = useState({
    new_followers: true, video_likes: true, tips_received: true,
    streak_reminders: false, room_checkins: true,
  });
  // focus prefs
  const [focus, setFocus] = useState({ session_timer: true, hide_view_counts: false, autoplay: false });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setCats(profile.category_focus ?? []);
    }
    const saved = localStorage.getItem("rise-prefs");
    if (saved) try { const p = JSON.parse(saved); setPrefs(p.prefs ?? prefs); setFocus(p.focus ?? focus); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || profile?.username,
      bio: bio.trim() || null,
      category_focus: cats,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
    qc.invalidateQueries({ queryKey: ["profile", profile?.username] });
  };

  const savePrefs = () => {
    localStorage.setItem("rise-prefs", JSON.stringify({ prefs, focus }));
    toast.success("Preferences saved");
  };

  const uploadAvatar = async (f: File | null) => {
    if (!f || !user) return;
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true, contentType: f.type });
    if (error) return toast.error(error.message);
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
    qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
    toast.success("Avatar updated");
  };

  const signOut = async () => { await supabase.auth.signOut(); nav({ to: "/" }); };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <aside className="card-rise p-3 h-fit">
          <p className="text-xs uppercase tracking-wider text-text-tertiary font-bold px-2 mb-2">Account</p>
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button key={s.id} onClick={() => setSection(s.id as any)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 ${active ? "bg-bg-surface text-text-primary" : "text-text-secondary hover:bg-bg-surface"}`}>
                <Icon className="w-4 h-4" /> {s.label}
              </button>
            );
          })}
          <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-accent-red hover:bg-bg-surface mt-4">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </aside>

        <section className="space-y-6">
          {section === "profile" && (
            <div className="card-rise p-6">
              <h2 className="text-xl font-black uppercase mb-4 flex items-center gap-2"><SettingsIcon className="w-5 h-5" /> Profile Settings</h2>
              <div className="flex items-center gap-4 mb-5">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-brand-purple flex items-center justify-center font-black text-xl">
                    {(profile?.username || "U").slice(0,2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-bold">{profile?.username}</p>
                  <label className="btn-ghost py-1.5 px-3 text-xs cursor-pointer inline-block mt-1 relative">
                    <input type="file" accept="image/*" onChange={e => uploadAvatar(e.target.files?.[0] ?? null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                    Upload Photo
                  </label>
                </div>
              </div>
              <Field label="Display name">
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full px-3 py-2.5" />
              </Field>
              <Field label="Bio">
                <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={300} className="w-full px-3 py-2.5 min-h-[80px]" />
              </Field>
              <Field label="Focus categories">
                <div className="flex flex-wrap gap-2">
                  {CATS.map(c => {
                    const active = cats.includes(c);
                    return (
                      <button key={c} type="button"
                        onClick={() => setCats(active ? cats.filter(x => x !== c) : [...cats, c])}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold ${active ? "bg-brand-orange text-white" : "bg-bg-surface text-text-secondary"}`}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <button onClick={saveProfile} disabled={saving} className="btn-primary mt-2">{saving ? "Saving…" : "Save Changes"}</button>
            </div>
          )}

          {section === "notifications" && (
            <div className="card-rise p-6">
              <h2 className="text-xl font-black uppercase mb-4">Notification Preferences</h2>
              {[
                ["new_followers", "New followers", "When someone starts following you"],
                ["video_likes", "Video likes", "When someone likes your video"],
                ["tips_received", "Tips received", "When someone sends you tokens"],
                ["streak_reminders", "Streak reminders", "Daily reminder to maintain your streak"],
                ["room_checkins", "Room check-ins", "Updates from your accountability rooms"],
              ].map(([k, label, desc]) => (
                <Toggle key={k as string} label={label as string} desc={desc as string}
                  on={(prefs as any)[k as string]}
                  onChange={(v) => setPrefs(p => ({ ...p, [k as string]: v }))}
                />
              ))}
              <button onClick={savePrefs} className="btn-primary mt-2">Save</button>
            </div>
          )}

          {section === "focus" && (
            <div className="card-rise p-6">
              <h2 className="text-xl font-black uppercase mb-4">Focus Mode</h2>
              {[
                ["session_timer", "Enable session timer", "Set a daily watch limit to stay productive"],
                ["hide_view_counts", "Hide view counts", "Focus on content quality, not popularity"],
                ["autoplay", "Autoplay next video", "Automatically play the next video in feed"],
              ].map(([k, label, desc]) => (
                <Toggle key={k as string} label={label as string} desc={desc as string}
                  on={(focus as any)[k as string]}
                  onChange={(v) => setFocus(p => ({ ...p, [k as string]: v }))}
                />
              ))}
              <button onClick={savePrefs} className="btn-primary mt-2">Save</button>
            </div>
          )}
        </section>
      </div>
    </div>
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

function Toggle({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-rise last:border-0">
      <div>
        <p className="font-bold text-sm">{label}</p>
        <p className="text-xs text-text-tertiary">{desc}</p>
      </div>
      <button onClick={() => onChange(!on)}
        className={`w-11 h-6 rounded-full relative transition-colors ${on ? "bg-brand-orange" : "bg-bg-surface"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}
