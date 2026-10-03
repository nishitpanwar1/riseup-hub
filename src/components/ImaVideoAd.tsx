import { useEffect, useRef, useState } from "react";

declare global {
  interface Window { google?: any }
}

const IMA_SDK = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";

/** RichAds pre-roll VAST tag, served through our same-origin proxy so the
 *  viewer's IP and user agent macros are filled in on the server. */
export function richAdsTagUrl() {
  if (typeof window === "undefined") return "/api/vast";
  return `${window.location.origin}/api/vast?cb=${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

let sdkPromise: Promise<void> | null = null;
function loadImaSdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.ima) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = IMA_SDK;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { sdkPromise = null; reject(new Error("IMA SDK failed to load")); };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

type Props = {
  /** Play only when this slot is the one on screen. */
  isActive: boolean;
  muted: boolean;
  volume: number;
  adTagUrl?: string;
  /** Called when no ad could be shown (no fill, blocked, error, timeout). */
  onFallback?: () => void;
  /** Called when the ad finished or was skipped. */
  onComplete?: () => void;
  /** Max wait for an ad to start before giving up (ms). */
  timeoutMs?: number;
  objectFit?: "cover" | "contain";
};

/**
 * IMA-driven VAST video ad unit. Fills its positioned parent.
 * Muted + autoplay + playsInline so phones, TVs and desktops never block it.
 */
export function ImaVideoAd({ isActive, muted, volume, adTagUrl, onFallback, onComplete, timeoutMs = 10000, objectFit = "cover" }: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const managerRef = useRef<any>(null);
  const loaderRef = useRef<any>(null);
  const requestedRef = useRef(false);
  const doneRef = useRef(false);

  // Keep latest values in refs so changing them never cancels the ad request.
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const volumeRef = useRef(volume); volumeRef.current = volume;
  const fallbackRef = useRef(onFallback); fallbackRef.current = onFallback;
  const completeRef = useRef(onComplete); completeRef.current = onComplete;
  const activeRef = useRef(isActive); activeRef.current = isActive;

  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!isActive || requestedRef.current) return;
    requestedRef.current = true;
    let started = false;
    let resizeHandler: (() => void) | null = null;

    const fail = (why: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      console.warn("[ad] no ad:", why);
      setFailed(true);
      fallbackRef.current?.();
    };
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setPlaying(false);
      completeRef.current?.();
    };
    const timer = window.setTimeout(() => { if (!started) fail("timeout"); }, timeoutMs);

    (async () => {
      try {
        await loadImaSdk();
        const ima = window.google!.ima;
        const shell = shellRef.current;
        const content = contentRef.current;
        const adContainer = containerRef.current;
        if (!shell || !content || !adContainer) return;

        ima.settings.setLocale("en");
        ima.settings.setDisableCustomPlaybackForIOS10Plus(true);
        ima.settings.setVpaidMode(ima.ImaSdkSettings.VpaidMode.ENABLED);
        ima.settings.setNumRedirects(8);

        const display = new ima.AdDisplayContainer(adContainer, content);
        display.initialize();
        const loader = new ima.AdsLoader(display);
        loaderRef.current = loader;

        resizeHandler = () => {
          const m = managerRef.current;
          if (m && shell) m.resize(shell.clientWidth, shell.clientHeight, ima.ViewMode.NORMAL);
        };

        loader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (e: any) => {
          const settings = new ima.AdsRenderingSettings();
          settings.restoreCustomPlaybackStateOnAdBreakComplete = true;
          settings.enablePreloading = true;
          const manager = e.getAdsManager(content, settings);
          managerRef.current = manager;

          manager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, (err: any) =>
            fail(err?.getError?.()?.toString?.() ?? "manager error"));
          manager.addEventListener(ima.AdEvent.Type.STARTED, () => {
            started = true;
            setPlaying(true);
            if (!activeRef.current) { try { manager.pause(); } catch { /* noop */ } }
          });
          manager.addEventListener(ima.AdEvent.Type.SKIPPED, finish);
          manager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, finish);
          manager.addEventListener(ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, () => { if (started) finish(); });

          try {
            manager.init(shell.clientWidth, shell.clientHeight, ima.ViewMode.NORMAL);
            manager.setVolume(mutedRef.current ? 0 : volumeRef.current);
            manager.start();
            window.addEventListener("resize", resizeHandler!);
          } catch {
            fail("start failed");
          }
        }, false);

        loader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, (err: any) =>
          fail(err?.getError?.()?.toString?.() ?? "loader error"), false);

        const req = new ima.AdsRequest();
        req.adTagUrl = adTagUrl ?? richAdsTagUrl();
        req.linearAdSlotWidth = shell.clientWidth;
        req.linearAdSlotHeight = shell.clientHeight;
        req.nonLinearAdSlotWidth = shell.clientWidth;
        req.nonLinearAdSlotHeight = Math.round(shell.clientHeight / 3);
        req.vastLoadTimeout = 8000;
        req.setAdWillAutoPlay(true);
        req.setAdWillPlayMuted(mutedRef.current);
        loader.requestAds(req);
      } catch (e) {
        fail(String(e));
      }
    })();

    return () => {
      window.clearTimeout(timer);
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Pause/resume with visibility.
  useEffect(() => {
    const m = managerRef.current;
    if (!m) return;
    try { isActive ? m.resume() : m.pause(); } catch { /* not started yet */ }
  }, [isActive]);

  useEffect(() => {
    const m = managerRef.current;
    if (!m) return;
    try { m.setVolume(muted ? 0 : volume); } catch { /* noop */ }
  }, [muted, volume]);

  useEffect(() => () => {
    try { managerRef.current?.destroy(); } catch { /* noop */ }
    try { loaderRef.current?.destroy(); } catch { /* noop */ }
  }, []);

  const fit = objectFit === "contain" ? "[&_video]:!object-contain" : "[&_video]:!object-cover";

  return (
    <div ref={shellRef} className="absolute inset-0 w-full h-full bg-black overflow-hidden">
      <video
        ref={contentRef}
        playsInline
        autoPlay
        muted
        preload="auto"
        className="w-full h-full object-cover pointer-events-none"
      />
      <div
        ref={containerRef}
        className={`absolute inset-0 [&_iframe]:!w-full [&_iframe]:!h-full [&>div]:!w-full [&>div]:!h-full [&_video]:!w-full [&_video]:!h-full ${fit}`}
      />
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-xs uppercase tracking-widest font-stat pointer-events-none">
          {failed ? "Sponsored break" : "Loading ad…"}
        </div>
      )}
    </div>
  );
}
