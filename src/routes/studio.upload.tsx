import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Upload, Film } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { getStorjUploadUrl } from "@/lib/upload.functions";

export const Route = createFileRoute("/studio/upload")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
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

const RATIOS: { label: string; value: number; short: boolean }[] = [
  { label: "9:16",  value: 9/16,  short: true  },
  { label: "3:4",   value: 3/4,   short: true  },
  { label: "4:5",   value: 4/5,   short: true  },
  { label: "1:1",   value: 1,     short: true  },
  { label: "16:9",  value: 16/9,  short: false },
];

function UploadPage() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [aspect, setAspect] = useState<string | null>(null);
  const [isShort, setIsShort] = useState<boolean>(true);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Vals>({
    resolver: zodResolver(schema),
    defaultValues: { category: "discipline" },
  });

  const handleFile = async (f: File | null) => {
    setProbe(null); setAspect(null); setFile(f);
    if (!f) return;
    try {
      const p = await probeVideo(f);
      const ratio = p.width / p.height;
      const match = RATIOS.find(r => Math.abs(ratio - r.value) / r.value < 0.08);
      if (!match) {
        toast.error(`Allowed ratios: 9:16, 3:4, 4:5, 1:1, 16:9 (yours: ${p.width}×${p.height})`);
        setFile(null); return;
      }
      setAspect(match.label);
      setIsShort(match.short);
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
    if (!file || !probe || !aspect) return toast.error("Pick a valid video first");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Sign in first");

    try {
      setProgress(5);
      // 1. presigned URL from Storj via server fn
      const { uploadUrl, playbackUrl } = await getStorjUploadUrl({
        data: { filename: file.name, fileType: file.type || "video/mp4", folder: isShort ? "shorts" : "videos" },
      });

      // 2. direct PUT to Storj with XHR for progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(5 + Math.round((e.loaded / e.total) * 75));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`)));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });

      // 3. thumbnail → supabase storage (auto-generate from video frame if none provided)
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
      if (thumbBlob) {
        const tPath = `${u.user.id}/${Date.now()}.${thumbExt}`;
        const { error: tErr } = await supabase.storage.from("thumbnails")
          .upload(tPath, thumbBlob, { upsert: false, contentType: thumbType });
        if (tErr) throw tErr;
        const { data: tPub } = supabase.storage.from("thumbnails").getPublicUrl(tPath);
        thumb = tPub.publicUrl;
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
      toast.success("Live in the feed");
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
        <p className="text-text-secondary mb-6">Direct-to-Storj streaming · no size cap · 9:16 · 3:4 · 4:5 · 1:1 · 16:9</p>

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
                  {(file.size / 1024 / 1024).toFixed(1)} MB · {probe.width}×{probe.height} · {aspect} · {Math.round(probe.duration)}s
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
                {thumbFile ? thumbFile.name : "Click to upload a cover image (auto-generated if blank)"}
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

          <button disabled={isSubmitting || !file || !aspect} type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-40">
            <Upload className="w-4 h-4" /> {isSubmitting ? "Uploading…" : "Publish"}
          </button>
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
