// In-browser AI auto-subtitles.
//
// Whisper runs locally through transformers.js (WebGPU when the device has it,
// WASM everywhere else). The model weights are fetched once from the public
// model CDN and cached by the browser, so captioning costs nothing per video —
// there is no transcription API in the loop at all.
import { decodeToMonoPCM } from "@/lib/audio-tools";

export const CAPTION_MODEL = "onnx-community/whisper-base";
const SAMPLE_RATE = 16000;

export type CaptionCue = { start: number; end: number; text: string };
export type CaptionTrack = {
  /** BCP-47-ish code stored with the video */
  code: string;
  label: string;
  /** WebVTT payload rendered by the players */
  vtt: string;
  auto: true;
};

export type CaptionProgress = {
  phase: "audio" | "model" | "transcribe" | "translate" | "done";
  ratio: number; // 0..1
  detail?: string;
};

export function captionsSupported() {
  return (
    typeof window !== "undefined" &&
    typeof WebAssembly !== "undefined" &&
    typeof OfflineAudioContext !== "undefined"
  );
}

let pipelinePromise: Promise<any> | null = null;

async function getTranscriber(onProgress?: (p: CaptionProgress) => void) {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const device = (navigator as any).gpu ? "webgpu" : "wasm";
      return pipeline("automatic-speech-recognition", CAPTION_MODEL, {
        dtype: device === "webgpu" ? "fp16" : "q8",
        device,
        progress_callback: (p: any) => {
          if (p?.status === "progress" && typeof p.progress === "number") {
            onProgress?.({ phase: "model", ratio: p.progress / 100, detail: "Loading AI model" });
          }
        },
      } as any);
    })().catch((e) => {
      pipelinePromise = null;
      throw e;
    });
  }
  return pipelinePromise;
}

function ts(seconds: number) {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function cuesToVtt(cues: CaptionCue[]) {
  const body = cues
    .filter((c) => c.text.trim())
    .map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(Math.max(c.end, c.start + 0.4))}\n${c.text.trim()}`)
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

function toCues(output: any, duration: number): CaptionCue[] {
  const chunks: any[] = Array.isArray(output?.chunks) ? output.chunks : [];
  if (chunks.length) {
    return chunks.map((c, i) => {
      const start = Number(c.timestamp?.[0] ?? 0);
      const rawEnd = Number(c.timestamp?.[1] ?? 0);
      const end = Number.isFinite(rawEnd) && rawEnd > start ? rawEnd : Math.min(duration, start + 3);
      return { start, end, text: String(c.text ?? "").trim() || `…${i}` };
    });
  }
  const text = String(output?.text ?? "").trim();
  return text ? [{ start: 0, end: duration, text }] : [];
}

/**
 * Transcribe a media file into caption tracks.
 * `translate` adds a second English track produced by Whisper's own
 * speech-to-English-text task (still fully local).
 */
export async function generateCaptions(
  file: Blob,
  opts: {
    translateToEnglish?: boolean;
    language?: string;
    onProgress?: (p: CaptionProgress) => void;
  } = {},
): Promise<CaptionTrack[]> {
  const { onProgress } = opts;
  onProgress?.({ phase: "audio", ratio: 0.05, detail: "Extracting audio" });
  const pcm = await decodeToMonoPCM(file, SAMPLE_RATE);
  const duration = pcm.length / SAMPLE_RATE;
  if (!pcm.length) throw new Error("This file has no audio track to caption.");

  const transcriber = await getTranscriber(onProgress);

  const run = async (task: "transcribe" | "translate") => {
    onProgress?.({
      phase: task === "translate" ? "translate" : "transcribe",
      ratio: task === "translate" ? 0.75 : 0.35,
      detail: task === "translate" ? "Translating to English" : "Listening to your video",
    });
    return transcriber(pcm, {
      task,
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      ...(opts.language && task === "transcribe" ? { language: opts.language } : {}),
    });
  };

  const tracks: CaptionTrack[] = [];

  const original = await run("transcribe");
  const originalCues = toCues(original, duration);
  if (originalCues.length) {
    tracks.push({
      code: opts.language ?? "auto",
      label: opts.language ? `${opts.language.toUpperCase()} (auto)` : "Original (auto)",
      vtt: cuesToVtt(originalCues),
      auto: true,
    });
  }

  if (opts.translateToEnglish) {
    const translated = await run("translate");
    const cues = toCues(translated, duration);
    const sameAsOriginal =
      cues.map((c) => c.text).join(" ") === originalCues.map((c) => c.text).join(" ");
    if (cues.length && !sameAsOriginal) {
      tracks.push({ code: "en", label: "English (AI translation)", vtt: cuesToVtt(cues), auto: true });
    }
  }

  onProgress?.({ phase: "done", ratio: 1 });
  if (!tracks.length) throw new Error("No speech detected in this video.");
  return tracks;
}

/** Parse the jsonb column back into typed tracks. */
export function parseCaptions(value: unknown): CaptionTrack[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (t: any) => t && typeof t.vtt === "string" && typeof t.label === "string",
  ) as CaptionTrack[];
}

/** Turn a stored VTT string into a blob URL a <track> element can load. */
export function vttObjectUrl(vtt: string) {
  return URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
}
