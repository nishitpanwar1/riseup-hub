import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Upload, Film, Zap, Clapperboard } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";

type Search = { type?: "short" | "long" };

export const Route = createFileRoute("/studio/upload")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    type: s.type === "long" ? "long" : s.type === "short" ? "short" : undefined,
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
  const [progress, setProgress] = useState(0);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Vals>({
    resolver: zodResolver(schema),
    defaultValues: { category: "discipline" },
  });

  const handleFile = async (f: File | null) => {
    setProbe(null); setFile(f);
    if (!f) return;
    try {
      const p = await probeVideo(f);
      const playable = await canRenderVideoFrame(f);
      if (!playable) {
        toast.error("This video codec will not play in browsers. Export as H.264 MP4 and upload again.");
        setFile(null);
        return;
      }
      setProbe(p);
    } catch {
      toast.error("Could not read video metadata");
      setFile(null);
    }
  };

  const handleThumb = (f: File | null) => {
    if (thumbPreview) URL.revokeObjectURL(thumbPreview);
    setThumbFile(f);
    setThumbPreview(f ? URL.createObjectURL(f) : null);
  };

  const onSubmit = async (vals: Vals) => {
    if (!file || !probe) return toast.error("Pick a video first");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Sign in first");

    const isShort = mode === "short";

    try {
      setProgress(5);
      // 1. upload video directly to the public video bucket
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
      const folder = isShort ? "shorts" : "videos";
      const videoPath = `${u.user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("videos").upload(videoPath, file, {
        contentType: file.type || "video/mp4",
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;
      setProgress(70);
      const { data: pub } = supabase.storage.from("videos").getPublicUrl(videoPath);
      const playbackUrl = pub.publicUrl;

      // 2. thumbnail
      let thumb = `https://placehold.co/${isShort ? "405x720" : "720x405"}/141414/FF6B35.png?text=${encodeURIComponent(vals.title)}`;
      let thumbBlob: Blob | null = thumbFile;
      let thumbExt = thumbFile ? (thumbFile.name.split(".").pop() || "jpg").toLowerCase() : "jpg";
      let thumbType = thumbFile?.type || "image/jpeg";
      if (!thumbBlob) {
        try {
          const auto = await captureVideoThumbnail(file);
          if (auto) { thumbBlob = auto; thumbExt = "jpg"; thumbType = "image/jpeg"; }
        } catch (e) { console.warn("auto-thumb failed", e); }
      }
      if (!thumbBlob) throw new Error("Could not auto-generate a thumbnail. Please upload a browser-playable H.264 MP4 or add a cover image.");
      if (thumbBlob) {
        const tPath = `${u.user.id}/thumbs/${Date.now()}.${thumbExt}`;
        const { error: tErr } = await supabase.storage.from("thumbnails").upload(tPath, thumbBlob, { upsert: false, contentType: thumbType });
        if (!tErr) {
          const { data: tPub } = supabase.storage.from("thumbnails").getPublicUrl(tPath);
          thumb = tPub.publicUrl;
        }
      }
      setProgress(90);

      const tags = vals.tags?.split(",").map(t => t.trim()).filter(Boolean).slice(0, 5) ?? [];

      const { error: insErr } = await supabase.from("videos").insert({
        user_id: u.user.id,
        title: vals.title,
        description: vals.description ?? null,
        category: vals.category,
        video_url: playbackUrl,
        thumbnail_url: thumb,
        duration: Math.round(probe.duration),
        is_short: isShort,
        tags,
        status: "active",
      });
      if (insErr) throw insErr;
      setProgress(100);
      toast.success(isShort ? "Short is live" : "Video is live");
      nav({ to: isShort ? "/shorts" : "/feed" });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Upload failed");
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-black uppercase mb-1">Studio · upload</h1>
        <p className="text-text-secondary mb-6">No size cap · streams directly · auto-thumbnail</p>

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
          <Field label="Thumbnail (optional image)">
            <div className="border-2 border-dashed border-rise rounded-xl p-4 text-center bg-bg-surface hover:border-brand-purple cursor-pointer relative flex items-center gap-4">
              <input type="file" accept="image/*" onChange={e => handleThumb(e.target.files?.[0] ?? null)} className="absolute inset-0 opacity-0 cursor-pointer" />
              {thumbPreview ? (
                <img src={thumbPreview} alt="Thumbnail preview" className="w-20 h-20 object-cover rounded-md" />
              ) : (
                <div className="w-20 h-20 rounded-md bg-bg-primary flex items-center justify-center text-text-tertiary text-xs">No image</div>
              )}
              <p className="text-sm text-text-secondary flex-1 text-left">
                {thumbFile ? thumbFile.name : "Click to upload a cover (auto-generated if blank)"}
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
              <p className="text-xs text-text-tertiary mt-1 font-stat">{progress}%</p>
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

function canRenderVideoFrame(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    const timeout = window.setTimeout(() => { cleanup(); resolve(false); }, 5000);
    const cleanup = () => { window.clearTimeout(timeout); URL.revokeObjectURL(url); };
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadeddata = () => { cleanup(); resolve(v.videoWidth > 0 && v.videoHeight > 0); };
    v.onerror = () => { cleanup(); resolve(false); };
    v.src = url;
  });
}

function captureVideoThumbnail(file: File, seekTo = 1): Promise<Blob | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = "anonymous";
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(seekTo, Math.max(0.1, (v.duration || 1) * 0.1));
    };
    v.onseeked = () => {
      try {
        const w = v.videoWidth, h = v.videoHeight;
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { cleanup(); return resolve(null); }
        ctx.drawImage(v, 0, 0, w, h);
        canvas.toBlob((b) => { cleanup(); resolve(b); }, "image/jpeg", 0.85);
      } catch { cleanup(); resolve(null); }
    };
    v.onerror = () => { cleanup(); resolve(null); };
    v.src = url;
  });
}
