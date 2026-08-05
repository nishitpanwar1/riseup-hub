import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Upload, Film, Zap, Clapperboard, Repeat2, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { planLadder, transcodeToRenditions, transcodingSupported, type Rendition, type TranscodeProgress } from "@/lib/transcode";

// ffmpeg.wasm keeps the source and every output in browser memory. Keep the
// automatic ladder conservative on phones; larger files upload directly.
const MAX_TRANSCODE_BYTES = 120 * 1024 * 1024;

type Search = { type?: "short" | "long"; remix?: string; title?: string; source?: string };

export const Route = createFileRoute("/studio/upload")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    type: s.type === "long" ? "long" : s.type === "short" ? "short" : undefined,
    remix: typeof s.remix === "string" ? s.remix : undefined,
    title: typeof s.title === "string" ? s.title : undefined,
    source: typeof s.source === "string" ? s.source : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: UploadPage,
});

const CATS = ["discipline","fitness","study","entrepreneur","mindset","finance","morning","sports"] as const;

const schema = z.object({
  title: z.string().min(3, "Min 3 chars").max(100),
  description: z.string().max(500).optional(),
  category: z.enum(CATS),
  tags: z.string().optional(),
});
type Vals = z.infer<typeof schema>;

type Probe = { duration: number; width: number; height: number };

function UploadPage() {
  const nav = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"short" | "long">(search.type ?? "short");
  const [file, setFile] = useState<File | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<{ url: string; blob: Blob }[]>([]);
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [genThumbs, setGenThumbs] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  // Quality ladder is always applied automatically when the browser supports it.
  const optimize = true;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Vals>({
    resolver: zodResolver(schema),
    defaultValues: { category: "discipline" },
  });

  // Prefill when arriving from a Remix action
  useEffect(() => {
    if (!search.remix || !search.title) return;
    setMode("short");
    reset({
      title: `Remix · ${search.title}`.slice(0, 100),
      description: search.source ? `🔁 Remix of @${search.source} — original: ${search.title}` : `🔁 Remix — original: ${search.title}`,
      category: "discipline",
      tags: "remix",
    });
  }, [search.remix, search.title, search.source, reset]);


  const handleFile = async (f: File | null) => {
    setProbe(null); setFile(f);
    candidates.forEach(c => URL.revokeObjectURL(c.url));
    setCandidates([]); setCandidateIdx(0);
    if (!f) return;
    // Non-blocking probe: don't hold the UI on codec checks.
    probeVideo(f).then(setProbe).catch(() => {
      toast.error("Could not read video metadata — try MP4/H.264");
    });
    // Auto-generate 3 thumbnail choices from different points in the video.
    setGenThumbs(true);
    try {
      const dur = await probeVideo(f).then(p => p.duration).catch(() => 0);
      const points = dur > 2 ? [dur * 0.1, dur * 0.4, dur * 0.75] : [0.2, 0.5, 0.9];
      const blobs = await Promise.all(points.map(p => captureVideoThumbnail(f, p).catch(() => null)));
      const list = blobs.filter(Boolean).map(b => ({ blob: b as Blob, url: URL.createObjectURL(b as Blob) }));
      setCandidates(list);
    } finally {
      setGenThumbs(false);
    }
  };

  const handleThumb = (f: File | null) => {
    if (thumbPreview) URL.revokeObjectURL(thumbPreview);
    setThumbFile(f);
    setThumbPreview(f ? URL.createObjectURL(f) : null);
  };

  const onSubmit = async (vals: Vals) => {
    if (!file) return toast.error("Pick a video first");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Sign in first");

    const isShort = mode === "short";
    const userId = u.user.id;

    try {
      setProgress(3);
      setStage("Preparing…");
      // Thumbnail priority: uploaded image → picked auto-frame → captured frame.
      const picked = candidates[candidateIdx];
      const thumbPromise: Promise<{ blob: Blob; ext: string; type: string } | null> = thumbFile
        ? Promise.resolve({ blob: thumbFile, ext: (thumbFile.name.split(".").pop() || "jpg").toLowerCase(), type: thumbFile.type || "image/jpeg" })
        : picked
          ? Promise.resolve({ blob: picked.blob, ext: "jpg", type: "image/jpeg" })
          : captureVideoThumbnail(file).then(b => (b ? { blob: b, ext: "jpg", type: "image/jpeg" } : null)).catch(() => null);

      const dims = probe ?? await probeVideo(file).catch(() => null);
      const folder = isShort ? "shorts" : "videos";
      const renditions: Rendition[] = [];
      let playbackUrl = "";

      const useWasm = optimize && !!dims && transcodingSupported() && file.size <= MAX_TRANSCODE_BYTES;

      if (useWasm && dims) {
        // ---- Free in-browser encode: 360p / 720p / 1080p H.264 + faststart ----
        const targets = planLadder(dims.width, dims.height);
        setStage(`Loading encoder…`);
        let outputs: Awaited<ReturnType<typeof transcodeToRenditions>> = [];
        try {
          outputs = await transcodeToRenditions(file, {
            width: dims.width,
            height: dims.height,
            targets,
            onProgress: (p: TranscodeProgress) => {
              setStage(`Encoding ${p.label} (${p.step}/${p.totalSteps})`);
              setProgress(Math.round(4 + p.overall * 51)); // 4% → 55%
            },
          });
        } catch (encodeError) {
          // CDN restrictions, low-memory phones and unsupported WebAssembly
          // must never prevent publishing. Fall back to the original file.
          console.warn("Automatic quality encoding unavailable; uploading original", encodeError);
          setStage("Encoder unavailable · uploading original");
        }

        for (let i = 0; i < outputs.length; i++) {
          const out = outputs[i];
          setStage(`Uploading ${out.label}`);
          const path = `${userId}/${folder}/${crypto.randomUUID()}_${out.height}p.mp4`;
          await uploadCloudStorageWithProgress("videos", path, out.blob, "video/mp4", (pct) => {
            const base = 56 + (i / outputs.length) * 26;
            setProgress(Math.round(base + (pct / 100) * (26 / outputs.length)));
          });
          const { data: pub } = supabase.storage.from("videos").getPublicUrl(path);
          renditions.push({ label: out.label, height: out.height, url: pub.publicUrl, bytes: out.blob.size });
        }
        // default playback = highest rendition available
        playbackUrl = [...renditions].sort((a, b) => a.height - b.height).pop()?.url ?? "";
      }

      if (!playbackUrl) {
        // ---- Direct passthrough upload ----
        setStage("Uploading video");
        const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
        const videoPath = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
        await uploadCloudStorageWithProgress("videos", videoPath, file, file.type || "video/mp4", (pct) => {
          setProgress(Math.max(6, Math.min(80, Math.round(6 + pct * 0.74))));
        });
        const { data: pub } = supabase.storage.from("videos").getPublicUrl(videoPath);
        playbackUrl = pub.publicUrl;
      }

      setProgress(84);
      setStage("Finishing thumbnail");

      // thumbnail — never blocks the publish; falls back to a generated placeholder.
      let thumb = `https://placehold.co/${isShort ? "405x720" : "720x405"}/141414/FF6B35.png?text=${encodeURIComponent(vals.title)}`;
      const t = await thumbPromise;
      setProgress(88);
      if (t) {
        try {
          const tPath = `${userId}/thumbs/${Date.now()}.${t.ext}`;
          const { error: tErr } = await supabase.storage.from("thumbnails").upload(tPath, t.blob, { upsert: false, contentType: t.type });
          if (!tErr) {
            const { data: tPub } = supabase.storage.from("thumbnails").getPublicUrl(tPath);
            thumb = tPub.publicUrl;
          }
        } catch (e) { console.warn("thumb upload failed", e); }
      }
      setProgress(93);
      setStage("Publishing");

      const tags = vals.tags?.split(",").map(t => t.trim()).filter(Boolean).slice(0, 5) ?? [];
      if (search.remix && !tags.includes("remix")) tags.unshift("remix");
      if (search.remix) tags.push(`remixed_from:${search.remix}`);

      const { error: insErr } = await supabase.from("videos").insert({
        user_id: userId,
        title: vals.title,
        description: vals.description ?? null,
        category: vals.category,
        video_url: playbackUrl,
        thumbnail_url: thumb,
        duration: Math.round(dims?.duration ?? probe?.duration ?? 0),
        is_short: isShort,
        tags,
        renditions: renditions as any,
        status: "active",
      });
      if (insErr) throw insErr;
      setProgress(100);
      setStage("Live");
      toast.success(isShort ? "Short is live" : "Video is live");
      nav({ to: isShort ? "/shorts" : "/feed" });
    } catch (e: any) {
      console.error(e);
      const message = e instanceof Error && e.message ? e.message : "Upload failed. Please try again.";
      toast.error(message);
      setProgress(0);
      setStage("");
    }
  };


  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-safe-nav lg:pb-8">
        <div className="hidden lg:block mb-2"><BackButton label="Back" /></div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase mb-1">Studio · upload</h1>
        <p className="text-text-secondary mb-6">No size cap · streams directly · auto-thumbnail</p>


        {search.remix && (
          <div className="mb-5 flex items-center gap-3 p-3 rounded-xl border border-brand-orange/40 bg-brand-orange/10">
            <Repeat2 className="w-5 h-5 text-brand-orange shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-bold uppercase tracking-wide text-brand-orange">Remixing</p>
              <p className="text-text-secondary truncate">
                {search.source ? `@${search.source} — ` : ""}{search.title ?? "original short"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => nav({ to: "/studio/upload", search: {} as any })}
              className="p-1.5 rounded-lg hover:bg-black/30 text-text-secondary"
              aria-label="Cancel remix"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}


        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button onClick={() => setMode("short")} className={`p-4 rounded-xl border-2 text-left transition-all ${mode === "short" ? "border-brand-orange bg-brand-orange/10" : "border-rise bg-bg-surface hover:border-brand-purple"}`}>
            <Zap className="w-6 h-6 text-brand-orange mb-2" />
            <p className="font-display font-black uppercase">Short</p>
            <p className="text-xs text-text-tertiary">Vertical · 9:16 · &lt;60s recommended</p>
          </button>
          <button onClick={() => setMode("long")} className={`p-4 rounded-xl border-2 text-left transition-all ${mode === "long" ? "border-brand-purple bg-brand-purple/10" : "border-rise bg-bg-surface hover:border-brand-purple"}`}>
            <Clapperboard className="w-6 h-6 text-brand-purple mb-2" />
            <p className="font-display font-black uppercase">Long form</p>
            <p className="text-xs text-text-tertiary">Horizontal · 16:9 · full episodes</p>
          </button>
        </div>

        <form
          method="post"
          action="#"
          onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void handleSubmit(onSubmit)(e); }}
          className="card-rise p-6 space-y-4"
        >
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-text-secondary font-semibold">Video file</span>
            <div className="mt-2 border-2 border-dashed border-rise rounded-xl p-8 text-center bg-bg-surface hover:border-brand-purple cursor-pointer relative">
              <input type="file" accept="video/*" onChange={e => handleFile(e.target.files?.[0] ?? null)} className="absolute inset-0 opacity-0 cursor-pointer" />
              <Film className="w-10 h-10 text-brand-orange mx-auto mb-2" />
              <p className="font-bold">{file ? file.name : "Click or drop your video"}</p>
              {file && probe && (
                <p className="text-xs text-text-tertiary mt-1 font-stat">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · {probe.width}×{probe.height} · {Math.round(probe.duration)}s
                </p>
              )}
            </div>
          </label>

          <Field label="Title" error={errors.title?.message}>
            <input {...register("title")} placeholder="Day 1 — Cold shower challenge" className="w-full px-3 py-2.5" />
          </Field>
          <Field label="Description" error={errors.description?.message}>
            <textarea {...register("description")} className="w-full px-3 py-2.5 min-h-[80px]" />
          </Field>
          <Field label="Category">
            <select {...register("category")} className="w-full px-3 py-2.5">
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Thumbnail">
            {(genThumbs || candidates.length > 0) && !thumbFile && (
              <div className="mb-3">
                <p className="text-xs text-text-tertiary mb-2">
                  {genThumbs ? "Generating thumbnail options…" : "Pick an auto-generated thumbnail"}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {genThumbs && candidates.length === 0 && [0, 1, 2].map(i => (
                    <div key={i} className={`rounded-lg bg-bg-surface animate-pulse ${mode === "short" ? "aspect-[9/16]" : "aspect-video"}`} />
                  ))}
                  {candidates.map((c, i) => (
                    <button
                      key={c.url}
                      type="button"
                      onClick={() => setCandidateIdx(i)}
                      className={`relative rounded-lg overflow-hidden border-2 transition-colors ${mode === "short" ? "aspect-[9/16]" : "aspect-video"} ${candidateIdx === i ? "border-brand-orange" : "border-rise"}`}
                    >
                      <img src={c.url} alt={`Thumbnail option ${i + 1}`} className="w-full h-full object-cover" />
                      {candidateIdx === i && (
                        <span className="absolute bottom-1 right-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-orange text-white">Selected</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="border-2 border-dashed border-rise rounded-xl p-4 text-center bg-bg-surface hover:border-brand-purple cursor-pointer relative flex items-center gap-4">
              <input type="file" accept="image/*" onChange={e => handleThumb(e.target.files?.[0] ?? null)} className="absolute inset-0 opacity-0 cursor-pointer" />
              {thumbPreview ? (
                <img src={thumbPreview} alt="Thumbnail preview" className="w-20 h-20 object-cover rounded-md" />
              ) : (
                <div className="w-20 h-20 rounded-md bg-bg-primary flex items-center justify-center text-text-tertiary text-xs shrink-0">No image</div>
              )}
              <p className="text-sm text-text-secondary flex-1 text-left">
                {thumbFile ? thumbFile.name : "Or upload your own cover image"}
              </p>
            </div>
          </Field>

          <Field label="Tags (comma separated, max 5)">
            <input {...register("tags")} placeholder="cold, discipline, morning" className="w-full px-3 py-2.5" />
          </Field>




          {progress > 0 && (
            <div>
              <div className="h-2 rounded-full bg-bg-surface overflow-hidden">
                <div className="h-full bg-brand-orange transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-text-tertiary mt-1 font-stat">{stage ? `${stage} · ` : ""}{progress}%</p>
            </div>
          )}


          <button disabled={isSubmitting || !file} type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-40">
            <Upload className="w-4 h-4" /> {isSubmitting ? "Uploading…" : `Publish ${mode === "short" ? "short" : "video"}`}
          </button>
          <p className="text-xs text-text-tertiary text-center">
            Want to sell digital products instead? <Link to="/studio/shop" className="text-brand-orange font-bold">Open Shop</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-text-secondary font-semibold">{label}</span>
      <div className="mt-1">{children}</div>
      {error && <span className="text-xs text-accent-red mt-1 block">{error}</span>}
    </label>
  );
}

async function uploadCloudStorageWithProgress(bucket: string, path: string, file: Blob, contentType: string, onProgress: (pct: number) => void) {
  let { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) {
    const refreshed = await supabase.auth.refreshSession();
    data = refreshed.data;
  }
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again before uploading.");
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey) throw new Error("Upload service is not configured.");
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const uploadUrl = `${baseUrl}/storage/v1/object/${bucket}/${encodedPath}`;

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.timeout = 30 * 60 * 1000;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", publishableKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress((event.loaded / event.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        let detail = "";
        try {
          const body = JSON.parse(xhr.responseText);
          detail = body.message || body.error || "";
        } catch {
          detail = xhr.responseText;
        }
        reject(new Error(detail || `Video upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Video upload failed. Please check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("Video upload timed out. Try a smaller MP4 or a stronger connection."));
    xhr.send(file);
  });
}

function probeVideo(file: File): Promise<Probe> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    const url = URL.createObjectURL(file);
    v.onloadedmetadata = () => {
      const out = { duration: v.duration || 0, width: v.videoWidth, height: v.videoHeight };
      URL.revokeObjectURL(url);
      if (!out.width || !out.height) reject(new Error("no dims"));
      else resolve(out);
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("video read failed")); };
    v.src = url;
  });
}

function canRenderVideoFrame(_file: File): Promise<boolean> {
  return Promise.resolve(true);
}

function captureVideoThumbnail(file: File, seekTo = 1): Promise<Blob | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = "anonymous";
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (b: Blob | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(b);
    };
    // Hard timeout so thumbnail capture can never hang the upload.
    const timer = window.setTimeout(() => finish(null), 8000);
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(seekTo, Math.max(0.1, (v.duration || 1) * 0.1));
    };
    v.onseeked = () => {
      try {
        const w = v.videoWidth, h = v.videoHeight;
        if (!w || !h) return finish(null);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(null);
        ctx.drawImage(v, 0, 0, w, h);
        canvas.toBlob((b) => finish(b), "image/jpeg", 0.85);
      } catch { finish(null); }
    };
    v.onerror = () => finish(null);
    v.src = url;
  });
}
