// Free, browser-side transcoding pipeline (ffmpeg.wasm).
// Produces browser-safe H.264 renditions (360p / 720p / 1080p, +faststart)
// so playback starts instantly and viewers can pick a quality — no servers,
// no GPUs, no cost. Runs entirely on the uploader's machine.
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

export const RENDITION_LADDER = [360, 720, 1080] as const;
export type RenditionHeight = (typeof RENDITION_LADDER)[number];

export type Rendition = {
  label: string;
  height: number;
  url: string;
  bytes: number;
};

export type TranscodeOutput = {
  label: string;
  height: number;
  blob: Blob;
};

let ffmpegPromise: Promise<FFmpeg> | null = null;

export function transcodingSupported() {
  return typeof window !== "undefined" && typeof WebAssembly !== "undefined";
}

async function getFFmpeg(onLog?: (msg: string) => void) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }) => onLog?.(message));
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })().catch((e) => {
      ffmpegPromise = null;
      throw e;
    });
  }
  return ffmpegPromise;
}

/** Even-number dimensions for the target short side (H.264 requires even). */
function targetSize(width: number, height: number, shortSide: number) {
  const isPortrait = height > width;
  const src = isPortrait ? width : height;
  const scale = Math.min(1, shortSide / src);
  const w = Math.max(2, Math.round((width * scale) / 2) * 2);
  const h = Math.max(2, Math.round((height * scale) / 2) * 2);
  return { w, h };
}

/** Which ladder steps make sense for this source (never upscale). */
export function planLadder(width: number, height: number): RenditionHeight[] {
  const shortSide = Math.min(width, height);
  const steps = RENDITION_LADDER.filter((p) => p <= shortSide + 32);
  return steps.length ? steps : [RENDITION_LADDER[0]];
}

export type TranscodeProgress = {
  step: number;          // 1-based rendition index
  totalSteps: number;
  label: string;
  ratio: number;         // 0..1 within this rendition
  overall: number;       // 0..1 across the whole ladder
};

/**
 * Transcode a source file into the requested renditions.
 * Each pass: H.264 (libx264) + AAC + faststart so the moov atom is up front
 * and the player can start before the file is fully buffered.
 */
export async function transcodeToRenditions(
  file: File,
  opts: {
    width: number;
    height: number;
    targets: number[];
    onProgress?: (p: TranscodeProgress) => void;
    onLog?: (msg: string) => void;
  },
): Promise<TranscodeOutput[]> {
  const ffmpeg = await getFFmpeg(opts.onLog);
  const inputName = "source_input";
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const outputs: TranscodeOutput[] = [];
  const total = opts.targets.length;

  for (let i = 0; i < total; i++) {
    const p = opts.targets[i];
    const { w, h } = targetSize(opts.width, opts.height, p);
    const outName = `out_${p}.mp4`;
    const label = `${p}p`;

    const handler = ({ progress }: { progress: number }) => {
      const ratio = Math.max(0, Math.min(1, progress));
      opts.onProgress?.({
        step: i + 1,
        totalSteps: total,
        label,
        ratio,
        overall: (i + ratio) / total,
      });
    };
    ffmpeg.on("progress", handler);

    try {
      await ffmpeg.exec([
        "-i", inputName,
        "-vf", `scale=${w}:${h}`,
        "-c:v", "libx264",
        "-profile:v", "main",
        "-pix_fmt", "yuv420p",
        "-preset", "veryfast",
        "-crf", p >= 1080 ? "24" : p >= 720 ? "25" : "28",
        "-g", "48",
        "-c:a", "aac",
        "-b:a", p >= 720 ? "128k" : "96k",
        "-movflags", "+faststart",
        "-y", outName,
      ]);
      const data = await ffmpeg.readFile(outName);
      const bytes = data as Uint8Array;
      if (bytes?.length) {
        outputs.push({
          label,
          height: p,
          blob: new Blob([bytes.slice().buffer as ArrayBuffer], { type: "video/mp4" }),
        });
      }
      await ffmpeg.deleteFile(outName).catch(() => {});
    } finally {
      ffmpeg.off("progress", handler);
    }
  }

  await ffmpeg.deleteFile(inputName).catch(() => {});
  return outputs;
}

/** Pick the best rendition for the current connection + viewport. */
export function pickRendition(renditions: Rendition[] | null | undefined, fallback: string) {
  if (!renditions?.length) return fallback;
  const sorted = [...renditions].sort((a, b) => a.height - b.height);
  let cap = 1080;
  if (typeof navigator !== "undefined") {
    const conn = (navigator as any).connection;
    const type = conn?.effectiveType as string | undefined;
    if (type === "2g" || type === "slow-2g") cap = 360;
    else if (type === "3g") cap = 720;
    if (conn?.saveData) cap = 360;
  }
  if (typeof window !== "undefined") {
    const px = Math.max(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1);
    if (px < 700) cap = Math.min(cap, 360);
    else if (px < 1400) cap = Math.min(cap, 720);
  }
  const best = sorted.filter((r) => r.height <= cap).pop() ?? sorted[0];
  return best?.url ?? fallback;
}

export function parseRenditions(value: unknown): Rendition[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r: any) => r && typeof r.url === "string" && typeof r.height === "number",
  ) as Rendition[];
}
