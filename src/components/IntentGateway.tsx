import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Target, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const FOCUS = ["discipline", "fitness", "study", "entrepreneur", "mindset", "finance", "morning", "sports"] as const;
const BUDGETS = [10, 20, 30, 45];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "Before you scroll" gateway — asks once per day what the user is here for,
 * stores it, and uses it to personalise the feed ranking.
 */
export function IntentGateway({ onSaved }: { onSaved?: (categories: string[]) => void }) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [budget, setBudget] = useState(20);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (loading || !user) return;
    const localKey = `riseup-intent-${user.id}`;
    if (localStorage.getItem(localKey) === todayKey()) return;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_intent")
        .select("categories")
        .eq("user_id", user.id)
        .eq("intent_date", todayKey())
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        localStorage.setItem(localKey, todayKey());
        onSaved?.(data.categories ?? []);
        return;
      }
      setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [loading, user, onSaved]);

  if (!mounted || !open || !user) return null;

  const toggle = (c: string) =>
    setPicked((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : prev.length >= 3 ? prev : [...prev, c]));

  const save = async () => {
    setSaving(true);
    try {
      await supabase.from("user_intent").upsert(
        { user_id: user.id, intent_date: todayKey(), categories: picked, minutes_budget: budget },
        { onConflict: "user_id,intent_date" },
      );
      await supabase.from("user_goals").upsert({ user_id: user.id, categories: picked }, { onConflict: "user_id" });
      localStorage.setItem(`riseup-intent-${user.id}`, todayKey());
      onSaved?.(picked);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="card-rise w-full sm:max-w-lg p-5 sm:p-7 rounded-t-2xl sm:rounded-2xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center gap-2 text-brand-orange">
          <Target className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">Intent gateway</span>
        </div>
        <h2 className="mt-2 text-2xl sm:text-3xl font-black uppercase leading-tight">What are you here for today?</h2>
        <p className="mt-1 text-sm text-text-secondary">Pick up to 3 focus areas. Your feed is built from this — not from an addiction loop.</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {FOCUS.map((c) => (
            <button
              key={c}
              onClick={() => toggle(c)}
              className={`px-3 py-2 rounded-full text-sm font-bold capitalize border transition ${
                picked.includes(c)
                  ? "bg-brand-orange text-black border-brand-orange"
                  : "border-rise text-text-secondary hover:text-text-primary"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <div className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Session budget</div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {BUDGETS.map((b) => (
              <button
                key={b}
                onClick={() => setBudget(b)}
                className={`py-2 rounded-lg text-sm font-bold border ${
                  budget === b ? "border-brand-orange text-text-primary" : "border-rise text-text-tertiary"
                }`}
              >
                {b}m
              </button>
            ))}
          </div>
        </div>

        <button disabled={saving || picked.length === 0} onClick={save} className="btn-primary w-full mt-6 disabled:opacity-50">
          <Flame className="w-4 h-4 inline mr-1" /> {saving ? "Setting up…" : "Start my session"}
        </button>
        <button onClick={() => { localStorage.setItem(`riseup-intent-${user.id}`, todayKey()); setOpen(false); }} className="w-full mt-3 text-sm text-text-tertiary hover:text-text-secondary">
          Skip for today
        </button>
      </div>
    </div>,
    document.body,
  );
}
