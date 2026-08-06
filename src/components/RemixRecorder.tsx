import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Circle, Square, X, RefreshCw, Music2, Timer } from "lucide-react";
import toast from "react-hot-toast";
import { pickRecorderMime, type SampledSound } from "@/lib/remix";

type Props = {
  sound: SampledSound;
  onClose: () => void;
  onCaptured: (clip: Blob, seconds: number) => void;
};

const LIMITS = [15, 30, 60];

/** Full-screen vertical recorder that plays the sampled sound while you film. */
export function RemixRecorder({ sound, onClose, onCaptured }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | undefined>(undefined);

  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [limit, setLimit] = useState(30);
  const [countdown, setCountdown] = useState(0);
  const [facing, setFacing] = useState<"user" | "environment">("user");

  const maxSeconds = Math.min(limit, Math.max(3, Math.floor(sound.seconds)));

  const start = useCallback(async (mode: "user" | "environment") => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
    } catch {
      toast.error("Camera access is needed to record a remix.");
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    void start(facing);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [facing, start]);

  const stop = useCallback(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    audioRef.current?.pause();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }, []);

  const begin = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 700));
    }
    setCountdown(0);

    chunksRef.current = [];
    const mimeType = pickRecorderMime();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = rec;
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      if (blob.size < 4096) { toast.error("That take was too short — try again."); return; }
      onCaptured(blob, elapsedRef.current);
    };
    rec.start();

    const audio = audioRef.current;
    if (audio) { audio.currentTime = 0; void audio.play().catch(() => {}); }

    setElapsed(0);
    elapsedRef.current = 0;
    setRecording(true);
    const startedAt = performance.now();
    tickRef.current = window.setInterval(() => {
      const s = (performance.now() - startedAt) / 1000;
      elapsedRef.current = s;
      setElapsed(s);
      if (s >= maxSeconds) stop();
    }, 100);
  };

  const elapsedRef = useRef(0);
  const pct = Math.min(100, (elapsed / maxSeconds) * 100);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <audio ref={audioRef} src={sound.url} preload="auto" />

      <div className="flex items-center justify-between px-4 py-3 text-text-primary">
        <button onClick={() => { stop(); onClose(); }} aria-label="Close recorder" className="p-2 rounded-full bg-white/10">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 max-w-[60%]">
          <Music2 className="w-4 h-4 text-brand-orange shrink-0" />
          <span className="text-xs font-semibold truncate">{sound.title} · @{sound.creator}</span>
        </div>
        <button
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          aria-label="Flip camera"
          className="p-2 rounded-full bg-white/10"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        {countdown > 0 && (
          <div className="absolute inset-0 grid place-items-center bg-black/50">
            <span className="text-7xl font-black text-text-primary">{countdown}</span>
          </div>
        )}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/20">
          <div className="h-full bg-brand-orange transition-[width] duration-100" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="px-4 py-5 flex flex-col items-center gap-4">
        {!recording && (
          <div className="flex gap-2">
            {LIMITS.map((l) => (
              <button
                key={l}
                onClick={() => setLimit(l)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold ${limit === l ? "bg-brand-orange text-black" : "bg-white/10 text-text-secondary"}`}
              >
                <Timer className="w-3 h-3 inline mr-1" />{l}s
              </button>
            ))}
          </div>
        )}
        <p className="font-stat text-sm text-text-secondary">
          {elapsed.toFixed(1)}s / {maxSeconds}s
        </p>
        <button
          disabled={!ready || countdown > 0}
          onClick={() => (recording ? stop() : begin())}
          className="w-20 h-20 rounded-full grid place-items-center bg-white/10 border-4 border-brand-orange disabled:opacity-40"
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {recording ? <Square className="w-8 h-8 text-brand-orange" /> : <Circle className="w-10 h-10 text-brand-orange fill-brand-orange" />}
        </button>
      </div>
    </div>,
    document.body,
  );
}
