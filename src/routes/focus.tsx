import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Timer, Plus, Check, Trash2, Coins, Flame, Play, Pause } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { MobileTabBar } from "@/components/MobileTabBar";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/focus")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Focus sessions | RiseUp" },
      { name: "description", content: "Run timed focus sessions, build your discipline streak and earn RiseUp tokens for finished work." },
      { property: "og:title", content: "Focus sessions | RiseUp" },
      { property: "og:description", content: "Timed deep-work sessions that pay you in tokens when you finish." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FocusPage,
});

const CATS = ["discipline", "fitness", "study", "entrepreneur", "mindset", "finance", "morning", "sports"];

type Task = {
  id: string;
  title: string;
  category: string | null;
  target_minutes: number;
  minutes_done: number;
  completed_at: string | null;
  created_at: string;
};

function FocusPage() {
  const { user, loading } = useAuth();
  const { data: profile } = useMyProfile();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("discipline");
  const [minutes, setMinutes] = useState(25);

  const { data: tasks = [] } = useQuery({
    queryKey: ["focus-tasks", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("focus_tasks")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const { data: tokens } = useQuery({
    queryKey: ["my-tokens", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_tokens").select("balance").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  // realtime: any change to my tasks or wallet updates instantly
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`focus-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "focus_tasks", filter: `user_id=eq.${user.id}` }, () =>
        qc.invalidateQueries({ queryKey: ["focus-tasks", user.id] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "user_tokens", filter: `user_id=eq.${user.id}` }, () =>
        qc.invalidateQueries({ queryKey: ["my-tokens", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, user?.id]);

  const todayDone = useMemo(
    () => tasks.filter((t) => t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString()),
    [tasks],
  );
  const minutesToday = todayDone.reduce((s, t) => s + t.minutes_done, 0);

  const addTask = async () => {
    if (!user || !title.trim()) return;
    const { error } = await supabase.from("focus_tasks").insert({
      user_id: user.id,
      title: title.trim(),
      category,
      target_minutes: Math.max(5, Math.min(180, minutes)),
    });
    if (error) return toast.error(error.message);
    setTitle("");
    qc.invalidateQueries({ queryKey: ["focus-tasks", user.id] });
  };

  if (loading) return <div className="min-h-screen bg-bg-primary" />;
  if (!user) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <AppHeader />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <Timer className="w-10 h-10 mx-auto text-brand-orange" />
          <h1 className="mt-4 text-2xl font-black uppercase">Focus sessions</h1>
          <p className="mt-2 text-text-secondary">Sign in to run timed sessions and earn tokens for finished work.</p>
          <Link to="/auth" className="btn-primary inline-block mt-6">Sign in</Link>
        </div>
        <MobileTabBar username={null} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-safe-nav lg:pb-8">
        <BackButton />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black uppercase leading-tight">Discipline focus</h1>
            <p className="text-sm text-text-secondary">Finish a session at full length to earn 15 tokens. Max 3 rewarded sessions per day.</p>
          </div>
          <div className="card-rise px-3 py-2 flex items-center gap-2 text-sm font-bold">
            <Coins className="w-4 h-4 text-accent-gold" /> {tokens?.balance ?? 0}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <Metric label="Sessions today" value={todayDone.length} />
          <Metric label="Focus minutes" value={minutesToday} />
          <Metric label="Rewarded" value={`${Math.min(3, todayDone.length)}/3`} />
        </div>

        <div className="card-rise p-4 sm:p-5 mt-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">New session</h2>
          <div className="mt-3 grid sm:grid-cols-[1fr_auto_auto_auto] gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="What are you working on?"
              className="w-full px-3 py-2.5 min-w-0"
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2.5 capitalize">
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="px-3 py-2.5">
              {[10, 15, 25, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
            <button onClick={addTask} className="btn-primary flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Add</button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {tasks.length === 0 && <p className="text-text-tertiary text-center py-10">No sessions yet. Add your first one above.</p>}
          {tasks.map((t) => <TaskCard key={t.id} task={t} onChanged={() => qc.invalidateQueries({ queryKey: ["focus-tasks", user.id] })} />)}
        </div>
      </div>
      <MobileTabBar username={profile?.username ?? null} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card-rise p-3 text-center">
      <div className="text-xl sm:text-2xl font-black font-stat">{value}</div>
      <div className="text-[10px] sm:text-xs uppercase tracking-wide text-text-tertiary">{label}</div>
    </div>
  );
}

function TaskCard({ task, onChanged }: { task: Task; onChanged: () => void }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(task.minutes_done * 60);
  const saved = useRef(task.minutes_done);
  const done = !!task.completed_at;

  useEffect(() => { setElapsed(task.minutes_done * 60); saved.current = task.minutes_done; }, [task.minutes_done]);

  useEffect(() => {
    if (!running || done) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [running, done]);

  // persist progress every minute so it survives refresh / device switch
  useEffect(() => {
    const mins = Math.floor(elapsed / 60);
    if (!running || done || mins <= saved.current) return;
    saved.current = mins;
    void supabase.from("focus_tasks").update({ minutes_done: mins }).eq("id", task.id);
    if (mins >= task.target_minutes) {
      setRunning(false);
      void complete();
    }
  }, [elapsed, running, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = async () => {
    const mins = Math.max(Math.floor(elapsed / 60), task.minutes_done);
    const { error } = await supabase
      .from("focus_tasks")
      .update({ minutes_done: mins, completed_at: new Date().toISOString() })
      .eq("id", task.id);
    if (error) return toast.error(error.message);
    toast.success(mins >= task.target_minutes ? "Session complete — tokens on the way." : "Session closed early — no tokens.");
    onChanged();
  };

  const remove = async () => {
    await supabase.from("focus_tasks").delete().eq("id", task.id);
    onChanged();
  };

  const pct = Math.min(100, Math.round((elapsed / (task.target_minutes * 60)) * 100));
  const left = Math.max(0, task.target_minutes * 60 - elapsed);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className={`card-rise p-4 ${done ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold truncate">{task.title}</h3>
          <p className="text-xs text-text-tertiary capitalize">{task.category} · {task.target_minutes} min target</p>
        </div>
        <div className="font-stat text-lg tabular-nums">{done ? <Flame className="w-5 h-5 text-brand-orange" /> : `${mm}:${ss}`}</div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-bg-surface overflow-hidden">
        <div className="h-full bg-brand-orange transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {!done && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setRunning((r) => !r)} className="btn-ghost flex items-center gap-1 text-sm">
            {running ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Start</>}
          </button>
          <button onClick={complete} className="btn-ghost flex items-center gap-1 text-sm"><Check className="w-4 h-4" /> Finish</button>
          <button onClick={remove} className="btn-ghost flex items-center gap-1 text-sm text-accent-red ml-auto"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
