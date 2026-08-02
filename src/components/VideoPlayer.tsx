import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play, Pause, Volume2, Volume1, VolumeX, Settings, Maximize, Minimize,
  PictureInPicture2, RotateCcw, RotateCw, Check,
} from "lucide-react";
import type { Rendition } from "@/lib/transcode";

type Props = {
  src: string;
  poster?: string | null;
  renditions: Rendition[];
  quality: string;
  onQualityChange: (q: string) => void;
  onTimeUpdate?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  autoPlay?: boolean;
};

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** YouTube-style control panel for long-form playback. */
export function VideoPlayer({ src, poster, renditions, quality, onQualityChange, onTimeUpdate, autoPlay }: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [menu, setMenu] = useState<null | "root" | "quality" | "speed">(null);
  const [ambient, setAmbient] = useState(true);
  const [stableVolume, setStableVolume] = useState(true);

  const wake = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!videoRef.current?.paused && !menu) setShowControls(false);
    }, 2800);
  }, [menu]);

  useEffect(() => () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
    v.playbackRate = speed;
  }, [volume, muted, speed, src]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
    wake();
  }, [wake]);

  const seekBy = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(v.duration || 0, Math.max(0, v.currentTime + delta));
    wake();
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowRight") seekBy(5);
      else if (e.key === "ArrowLeft") seekBy(-5);
      else if (e.key === "m") setMuted(m => !m);
      else if (e.key === "f") void toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggle]);

  const toggleFullscreen = async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch { /* unsupported */ }
  };

  const pip = async () => {
    const v = videoRef.current as any;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await (document as any).exitPictureInPicture();
      else await v.requestPictureInPicture?.();
    } catch { /* unsupported */ }
  };

  const scrub = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const bar = e.currentTarget.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const ratio = Math.min(1, Math.max(0, (clientX - bar.left) / bar.width));
    const v = videoRef.current;
    if (v && v.duration) v.currentTime = ratio * v.duration;
    wake();
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const activeLabel = quality === "auto"
    ? "Auto"
    : renditions.find(r => String(r.height) === quality)?.label ?? quality;

  return (
    <div
      ref={shellRef}
      onMouseMove={wake}
      onMouseLeave={() => { if (playing && !menu) setShowControls(false); }}
      className="relative w-full bg-black rounded-2xl overflow-hidden select-none group"
    >
      {ambient && poster && (
        <img
          src={poster}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 w-full h-full object-cover blur-3xl scale-125 opacity-30"
        />
      )}

      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        autoPlay={autoPlay}
        playsInline
        preload="auto"
        onClick={toggle}
        onPlay={() => { setPlaying(true); wake(); }}
        onPause={() => { setPlaying(false); setShowControls(true); }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onTimeUpdate={(e) => { setCurrent(e.currentTarget.currentTime); onTimeUpdate?.(e); }}
        className="relative w-full max-h-[78vh] object-contain bg-black aspect-video"
      />

      {/* big centre play button when paused */}
      {!playing && (
        <button
          onClick={toggle}
          aria-label="Play"
          className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white"
        >
          <Play className="w-7 h-7 fill-white translate-x-0.5" />
        </button>
      )}

      {/* control panel */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 sm:px-3 pb-2 pt-10 transition-opacity duration-200 ${
          showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* seek bar */}
        <div
          className="group/bar relative h-4 flex items-center cursor-pointer"
          onClick={scrub}
          onTouchStart={scrub}
        >
          <div className="relative h-1 w-full rounded-full bg-white/25 group-hover/bar:h-1.5 transition-all">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/40" style={{ width: `${bufPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand-orange" style={{ width: `${pct}%` }} />
            <span
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-brand-orange opacity-0 group-hover/bar:opacity-100 transition-opacity"
              style={{ left: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-1 flex items-center gap-1 sm:gap-2 text-white">
          <IconBtn label={playing ? "Pause" : "Play"} onClick={toggle}>
            {playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
          </IconBtn>
          <IconBtn label="Back 10 seconds" onClick={() => seekBy(-10)} className="hidden sm:inline-flex">
            <RotateCcw className="w-5 h-5" />
          </IconBtn>
          <IconBtn label="Forward 10 seconds" onClick={() => seekBy(10)} className="hidden sm:inline-flex">
            <RotateCw className="w-5 h-5" />
          </IconBtn>

          {/* volume + expanding slider */}
          <div className="flex items-center group/vol">
            <IconBtn label="Mute" onClick={() => setMuted(m => !m)}>
              {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : volume < 0.5 ? <Volume1 className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </IconBtn>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => { const v = Number(e.target.value); setVolume(v); setMuted(v === 0); }}
              aria-label="Volume"
              className="w-0 group-hover/vol:w-20 focus:w-20 transition-all duration-200 h-1 accent-white cursor-pointer"
            />
          </div>

          <span className="ml-1 text-xs font-stat text-white/90 whitespace-nowrap">
            {fmt(current)} / {fmt(duration)}
          </span>

          <div className="flex-1" />

          <div className="relative">
            <IconBtn label="Settings" onClick={() => setMenu(m => (m ? null : "root"))}>
              <Settings className={`w-5 h-5 transition-transform ${menu ? "rotate-45" : ""}`} />
            </IconBtn>
            {menu && (
              <div className="absolute bottom-11 right-0 w-60 rounded-xl border border-rise bg-black/95 backdrop-blur p-1.5 text-sm shadow-2xl">
                {menu === "root" && (
                  <>
                    <MenuToggle label="Stable volume" on={stableVolume} onClick={() => setStableVolume(s => !s)} />
                    <MenuToggle label="Ambient mode" on={ambient} onClick={() => setAmbient(a => !a)} />
                    <MenuRow label="Playback speed" value={speed === 1 ? "Normal" : `${speed}x`} onClick={() => setMenu("speed")} />
                    <MenuRow label="Quality" value={activeLabel} onClick={() => setMenu("quality")} disabled={renditions.length === 0} />
                  </>
                )}
                {menu === "speed" && (
                  <>
                    <MenuHeader onBack={() => setMenu("root")}>Playback speed</MenuHeader>
                    {SPEEDS.map(s => (
                      <MenuOption key={s} label={s === 1 ? "Normal" : `${s}x`} active={s === speed} onClick={() => { setSpeed(s); setMenu("root"); }} />
                    ))}
                  </>
                )}
                {menu === "quality" && (
                  <>
                    <MenuHeader onBack={() => setMenu("root")}>Quality</MenuHeader>
                    <MenuOption label="Auto" active={quality === "auto"} onClick={() => { onQualityChange("auto"); setMenu("root"); }} />
                    {[...renditions].sort((a, b) => b.height - a.height).map(r => (
                      <MenuOption
                        key={r.height}
                        label={r.label}
                        active={quality === String(r.height)}
                        onClick={() => { onQualityChange(String(r.height)); setMenu("root"); }}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <IconBtn label="Picture in picture" onClick={pip} className="hidden sm:inline-flex">
            <PictureInPicture2 className="w-5 h-5" />
          </IconBtn>
          <IconBtn label="Fullscreen" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, label, onClick, className = "" }: { children: React.ReactNode; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-full hover:bg-white/15 ${className}`}
    >
      {children}
    </button>
  );
}

function MenuRow({ label, value, onClick, disabled }: { label: string; value: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-white/90 hover:bg-white/10 ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <span>{label}</span>
      <span className="text-white/60 text-xs">{value} ›</span>
    </button>
  );
}

function MenuToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-white/90 hover:bg-white/10">
      <span>{label}</span>
      <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${on ? "bg-brand-orange" : "bg-white/25"}`}>
        <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

function MenuHeader({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="w-full text-left px-3 py-2 mb-1 border-b border-rise text-white/70 text-xs uppercase tracking-wider">
      ‹ {children}
    </button>
  );
}

function MenuOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-white/90 hover:bg-white/10">
      <Check className={`w-4 h-4 ${active ? "opacity-100 text-brand-orange" : "opacity-0"}`} />
      <span>{label}</span>
    </button>
  );
}
