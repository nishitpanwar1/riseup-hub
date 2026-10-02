import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flame, ShoppingBag, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type GateCtx = {
  /** Runs `action` when signed in, otherwise opens the sign-in sheet. Returns true when it ran. */
  requireAuth: (action?: () => void, reason?: string) => boolean;
  signedIn: boolean;
  registerGuestView: (contentId: string) => boolean;
  guestViewsLeft: number;
};

const GUEST_VIEW_LIMIT = 7;
const Ctx = createContext<GateCtx>({ requireAuth: () => true, signedIn: false, registerGuestView: () => true, guestViewsLeft: GUEST_VIEW_LIMIT });

export function useAuthGate() {
  return useContext(Ctx);
}

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [reason, setReason] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [guestViews, setGuestViews] = useState<string[]>([]);

  useEffect(() => {
    if (user || typeof window === "undefined") return;
    try {
      const stored = JSON.parse(localStorage.getItem("riseup:guest-views") ?? "[]");
      if (Array.isArray(stored)) setGuestViews(stored.filter((item): item is string => typeof item === "string").slice(0, GUEST_VIEW_LIMIT));
    } catch {
      localStorage.removeItem("riseup:guest-views");
    }
  }, [user]);

  const requireAuth = useCallback(
    (action?: () => void, why?: string) => {
      if (user) {
        action?.();
        return true;
      }
      if (loading) return false;
      setReason(why ?? "Create a free account to do this. Watching stays open to everyone.");
      return false;
    },
    [user, loading],
  );

  const value = useMemo(() => ({ requireAuth, signedIn: !!user }), [requireAuth, user]);

  const registerGuestView = useCallback((contentId: string) => {
    if (user) return true;
    if (guestViews.includes(contentId)) return true;
    if (guestViews.length >= GUEST_VIEW_LIMIT) {
      setLimitReached(true);
      return false;
    }
    const next = [...guestViews, contentId].slice(-GUEST_VIEW_LIMIT);
    setGuestViews(next);
    localStorage.setItem("riseup:guest-views", JSON.stringify(next));
    if (next.length === GUEST_VIEW_LIMIT) setLimitReached(true);
    return true;
  }, [guestViews, user]);

  const guestViewsLeft = user ? GUEST_VIEW_LIMIT : Math.max(0, GUEST_VIEW_LIMIT - guestViews.length);
  const value = useMemo(
    () => ({ requireAuth, signedIn: !!user, registerGuestView, guestViewsLeft }),
    [requireAuth, user, registerGuestView, guestViewsLeft],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {reason && <SignInSheet reason={reason} onClose={() => setReason(null)} />}
      {limitReached && !user && <ViewingLimitSheet onClose={() => setLimitReached(false)} />}
    </Ctx.Provider>
  );
}

function ViewingLimitSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-lg card-rise p-6 rounded-t-2xl sm:rounded-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6">
        <Flame className="w-9 h-9 text-brand-orange" />
        <h2 className="mt-3 text-2xl font-black uppercase">Your free watch pass is complete</h2>
        <p className="mt-2 text-sm text-text-secondary">Create an account to keep watching and unlock likes, comments, follows, rooms and focus sessions.</p>
        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          <Link to="/auth" search={{ mode: "signup" } as any} className="btn-primary text-center">Create free account</Link>
          <Link to="/shop" onClick={onClose} className="btn-ghost text-center inline-flex items-center justify-center gap-2"><ShoppingBag className="w-4 h-4" /> View paid options</Link>
        </div>
      </div>
    </div>
  );
}

function SignInSheet({ reason, onClose }: { reason: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md card-rise p-6 rounded-t-2xl sm:rounded-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 p-1 rounded-lg hover:bg-bg-surface">
          <X className="w-5 h-5" />
        </button>
        <Flame className="w-8 h-8 text-brand-orange" />
        <h2 className="mt-3 text-xl font-black uppercase tracking-tight">Sign in to continue</h2>
        <p className="mt-2 text-sm text-text-secondary">{reason}</p>
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <Link to="/auth" onClick={onClose} className="btn-primary flex-1 text-center">Sign in</Link>
          <Link to="/auth" search={{ mode: "signup" } as any} onClick={onClose} className="btn-ghost flex-1 text-center">
            Create account
          </Link>
        </div>
        <button onClick={onClose} className="mt-4 w-full text-xs text-text-tertiary hover:text-text-secondary">
          Keep watching without an account
        </button>
      </div>
    </div>
  );
}
