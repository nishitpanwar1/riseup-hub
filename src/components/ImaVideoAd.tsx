import { useEffect, useRef, useState } from "react";

declare global {
  interface Window { google?: any }
}

const IMA_SDK = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";

/** Google's official linear video (VAST) sample tag — serves a real video ad. */
export const GOOGLE_LINEAR_VAST_TAG =
  "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples" +
  "&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1" +
  "&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=";

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
  onFallback?: () => void;
};

/**
 * Full-bleed 9:16 IMA video ad unit.
 * Muted + autoplay + playsInline so mobile browsers never block the stream.
 */
export function ImaVideoAd({ isActive, muted, volume, adTagUrl = GOOGLE_LINEAR_VAST_TAG, onFallback }: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const managerRef = useRef<any>(null);
  const loaderRef = useRef<any>(null);
  const displayRef = useRef<any>(null);
  const initedRef = useRef(false);
  const requestedRef = useRef(false);

  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Build the IMA pipeline the first time this slot becomes active.
  useEffect(() => {
    if (!isActive || requestedRef.current) return;
    requestedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        await loadImaSdk();
        if (cancelled) return;
        const ima = window.google!.ima;
        const shell = shellRef.current;
        const content = contentRef.current;
        const adContainer = containerRef.current;
        if (!shell || !content || !adContainer) return;

        ima.settings.setLocale("en");
        ima.settings.setDisableCustomPlaybackForIOS10Plus(true);

        const display = new ima.AdDisplayContainer(adContainer, content);
        displayRef.current = display;
        display.initialize();
        initedRef.current = true;

        const loader = new ima.AdsLoader(display);
        loaderRef.current = loader;

        const resize = () => {
          const m = managerRef.current;
          if (m) m.resize(shell.clientWidth, shell.clientHeight, ima.ViewMode.NORMAL);
        };

        loader.addEventListener(
          ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
          (e: any) => {
            if (cancelled) return;
            const settings = new ima.AdsRenderingSettings();
            settings.restoreCustomPlaybackStateOnAdBreakComplete = true;
            const manager = e.getAdsManager(content, settings);
            managerRef.current = manager;

            manager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, (err: any) => {
              console.warn("[ima] manager error", err?.getError?.()?.toString?.());
              setFailed(true);
              onFallback?.();
            });
            manager.addEventListener(ima.AdEvent.Type.STARTED, () => setPlaying(true));
            manager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () => setPlaying(false));

            try {
              manager.init(shell.clientWidth, shell.clientHeight, ima.ViewMode.NORMAL);
              manager.setVolume(muted ? 0 : volume);
              manager.start();
              window.addEventListener("resize", resize);
            } catch {
              setFailed(true);
              onFallback?.();
            }
          },
          false
        );

        loader.addEventListener(
          ima.AdErrorEvent.Type.AD_ERROR,
          (err: any) => { console.warn("[ima] loader error", err?.getError?.()?.toString?.()); setFailed(true); onFallback?.(); },
          false
        );

        const req = new ima.AdsRequest();
        req.adTagUrl = adTagUrl;
        req.linearAdSlotWidth = shell.clientWidth;
        req.linearAdSlotHeight = shell.clientHeight;
        req.nonLinearAdSlotWidth = shell.clientWidth;
        req.nonLinearAdSlotHeight = Math.round(shell.clientHeight / 3);
        req.setAdWillAutoPlay(true);
        req.setAdWillPlayMuted(true);
        loader.requestAds(req);
      } catch (e) {
        console.warn("[ima] setup error", e);
        if (!cancelled) { setFailed(true); onFallback?.(); }
      }
    })();

    return () => { cancelled = true; };
  }, [isActive, adTagUrl, muted, volume, onFallback]);

  // Pause/resume with the feed.
  useEffect(() => {
    const m = managerRef.current;
    if (!m) return;
    try { isActive ? m.resume() : m.pause(); } catch { /* not started yet */ }
  }, [isActive]);

  // Follow the feed's mute/volume state.
  useEffect(() => {
    const m = managerRef.current;
    if (!m) return;
    try { m.setVolume(muted ? 0 : volume); } catch { /* noop */ }
  }, [muted, volume]);

  useEffect(() => () => {
    try { managerRef.current?.destroy(); } catch { /* noop */ }
    try { loaderRef.current?.destroy(); } catch { /* noop */ }
  }, []);

  return (
    <div ref={shellRef} className="absolute inset-0 w-full h-full bg-black overflow-hidden">
      {/* IMA needs a real content element even when only the ad plays. */}
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
        className="absolute inset-0 [&_iframe]:!w-full [&_iframe]:!h-full [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover"
      />
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-xs uppercase tracking-widest font-stat pointer-events-none">
          {failed ? "Sponsored break" : "Loading sponsored break…"}
        </div>
      )}
    </div>
  );
}
