// Browser-side audio utilities shared by the caption engine and the
// Remix / Audio-Sampling studio. Everything runs on the user's machine:
// no server, no API keys, no cost.

/** Decode any media file/blob into mono PCM at the requested sample rate. */
export async function decodeToMonoPCM(source: Blob, sampleRate = 16000): Promise<Float32Array> {
  const buf = await source.arrayBuffer();
  const Ctx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  const decoder = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(buf.slice(0));
  } finally {
    void decoder.close();
  }

  const frames = Math.max(1, Math.ceil((decoded.duration * sampleRate)));
  const offline = new OfflineAudioContext(1, frames, sampleRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

/** Encode mono PCM into a standard 16-bit WAV file. */
export function encodeWav(pcm: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  let offset = 44;
  for (let i = 0; i < pcm.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Pull the audio track out of a video so it can be re-used as a Remix sound.
 * Decoded in the browser and re-encoded to WAV, which every browser can play
 * back and ffmpeg.wasm can mux without another decode pass.
 */
export async function extractSampledAudio(source: Blob, sampleRate = 44100) {
  const pcm = await decodeToMonoPCM(source, sampleRate);
  return { blob: encodeWav(pcm, sampleRate), seconds: pcm.length / sampleRate };
}

/** Fetch a remote video as a Blob (same-origin proxy friendly). */
export async function fetchMedia(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`Could not load source media (${res.status})`);
  return res.blob();
}
