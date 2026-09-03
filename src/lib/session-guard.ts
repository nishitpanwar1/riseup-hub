import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps the auth session alive across long idle periods, tab sleep and
 * network drops — the root cause of "Failed to fetch" on sign-in after the
 * app has been left open for hours (stale refresh token + dead socket).
 */
export function startSessionGuard() {
  if (typeof window === "undefined") return () => {};

  let busy = false;
  const refresh = async () => {
    if (busy || document.visibilityState === "hidden") return;
    busy = true;
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const expiresAt = (data.session.expires_at ?? 0) * 1000;
      // Refresh when the token expires within 5 minutes (or already has).
      if (expiresAt - Date.now() < 5 * 60_000) {
        await supabase.auth.refreshSession();
      }
    } catch {
      /* offline — the next visibility/online event retries */
    } finally {
      busy = false;
    }
  };

  const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
  const timer = window.setInterval(refresh, 4 * 60_000);
  window.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", refresh);
  void refresh();

  return () => {
    window.clearInterval(timer);
    window.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", refresh);
  };
}

/** Retries a network call a couple of times — survives transient offline blips. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = String((error as Error)?.message ?? "");
      const retryable = /fetch|network|timeout|Load failed/i.test(message);
      if (!retryable || i === attempts - 1) throw error;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastError;
}
