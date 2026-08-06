// Remix / Audio-Sampling engine.
//
// Lets a creator lift the audio track off any RiseUp video (long-form or
// Short) and build a brand-new Short on top of it — the loop that drives
// sound-led virality. All processing is local (Web Audio + ffmpeg.wasm).
import { getFFmpeg } from "@/lib/transcode";
import { extractSampledAudio, fetchMedia } from "@/lib/audio-tools";
import { resolveVideoSrc } from "@/lib/video-url";

export type SampledSound = {
  videoId: string;
  title: string;
  creator: string;
  blob: Blob;
  url: string;
  seconds: number;
};

/** Download a source video and lift its audio into a reusable sound. */
export async function sampleSoundFromVideo(input: {
  videoId: string;
  title: string;
  creator: string;
  videoUrl: string;
}): Promise<SampledSound> {
  const media = await fetchMedia(resolveVideoSrc(input.videoUrl));
  const { blob, seconds } = await extractSampledAudio(media);
  return {
    videoId: input.videoId,
    title: input.title,
    creator: input.creator,
    blob,
    url: URL.createObjectURL(blob),
    seconds,
  };
}

export type MuxProgress = { ratio: number };

/**
 * Replace a clip's audio with a sampled sound and normalise the result to a
 * browser-safe H.264/AAC MP4. Output is trimmed to the shorter of the two, so
 * a 15s recording over a 3-minute song ends at 15s.
 */
export async function muxWithSampledAudio(
  video: Blob,
  audio: Blob,
  opts: { keepOriginalAudio?: boolean; originalVolume?: number; onProgress?: (p: MuxProgress) => void } = {},
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  const vName = "remix_video_input";
  const aName = "remix_audio_input.wav";
  const outName = "remix_out.mp4";

  await ffmpeg.writeFile(vName, new Uint8Array(await video.arrayBuffer()));
  await ffmpeg.writeFile(aName, new Uint8Array(await audio.arrayBuffer()));

  const handler = ({ progress }: { progress: number }) =>
    opts.onProgress?.({ ratio: Math.max(0, Math.min(1, progress)) });
  ffmpeg.on("progress", handler);

  const mixArgs = opts.keepOriginalAudio
    ? [
        "-filter_complex",
        `[0:a]volume=${opts.originalVolume ?? 0.35}[a0];[a0][1:a]amix=inputs=2:duration=shortest:dropout_transition=0[aout]`,
        "-map", "0:v:0",
        "-map", "[aout]",
      ]
    : ["-map", "0:v:0", "-map", "1:a:0"];

  try {
    await ffmpeg.exec([
      "-i", vName,
      "-i", aName,
      ...mixArgs,
      "-c:v", "libx264",
      "-profile:v", "main",
      "-pix_fmt", "yuv420p",
      "-preset", "veryfast",
      "-crf", "24",
      "-c:a", "aac",
      "-b:a", "128k",
      "-shortest",
      "-movflags", "+faststart",
      "-y", outName,
    ]);
    const data = (await ffmpeg.readFile(outName)) as Uint8Array;
    if (!data?.length) throw new Error("Remix render produced no output");
    return new Blob([data.slice().buffer as ArrayBuffer], { type: "video/mp4" });
  } finally {
    ffmpeg.off("progress", handler);
    await ffmpeg.deleteFile(vName).catch(() => {});
    await ffmpeg.deleteFile(aName).catch(() => {});
    await ffmpeg.deleteFile(outName).catch(() => {});
  }
}

/** Best-supported vertical recording MIME type for this browser. */
export function pickRecorderMime() {
  const candidates = [
    "video/mp4;codecs=avc1,mp4a",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}
