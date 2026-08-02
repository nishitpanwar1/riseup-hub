import { useEffect, useState } from "react";

/**
 * Native-app style launch screen: RiseUp mark on black, fades out once the app
 * is ready. Shown once per browsing session (and on every cold start of the
 * installed app, which is exactly the YouTube-app behaviour).
 */
export function RiseUpSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("riseup:splash") === "1"; } catch { /* private mode */ }
    if (seen) return;
    setVisible(true);
    try { sessionStorage.setItem("riseup:splash", "1"); } catch { /* ignore */ }
    const fade = window.setTimeout(() => setFading(true), 1100);
    const hide = window.setTimeout(() => setVisible(false), 1650);
    return () => { window.clearTimeout(fade); window.clearTimeout(hide); };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg-primary transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <img
        src="/riseup-icon-512.png"
        alt=""
        width={112}
        height={112}
        className="w-28 h-28 rounded-3xl animate-[riseup-pop_600ms_ease-out]"
      />
      <span className="mt-5 font-display text-3xl font-black tracking-tight">RISEUP</span>
      <span className="mt-1 text-[11px] uppercase tracking-[0.3em] text-text-tertiary">built for your rise</span>
      <span className="absolute bottom-16 h-0.5 w-24 overflow-hidden rounded-full bg-bg-surface">
        <span className="block h-full w-1/2 rounded-full bg-brand-orange animate-[riseup-load_1200ms_ease-in-out_infinite]" />
      </span>
    </div>
  );
}
