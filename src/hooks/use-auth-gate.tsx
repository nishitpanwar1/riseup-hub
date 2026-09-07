import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flame, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type GateCtx = {
  /** Runs `action` when signed in, otherwise opens the sign-in sheet. Returns true when it ran. */
  requireAuth: (action?: () => void, reason?: string) => boolean;
  signedIn: boolean;
};

const Ctx = createContext<GateCtx>({ requireAuth: () => true, signedIn: false });

export function useAuthGate() {
  return useContext(Ctx);
}

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [reason, setReason] = useState<string | null>(null);

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

  return (
    <Ctx.Provider value={value}>
      {children}
      {reason && <SignInSheet reason={reason} onClose={() => setReason(null)} />}
    </Ctx.Provider>
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
