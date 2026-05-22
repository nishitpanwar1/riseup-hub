import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Upload, Film } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";

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
  thumbnail_url: z.string().url().optional().or(z.literal("")),
  tags: z.string().optional(),
});
type Vals = z.infer<typeof schema>;

type Probe = { duration: number; width: number; height: number };

function UploadPage() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [aspect, setAspect] = useState<"9:16" | "16:9" | null>(null);
  const [progress, setProgress] = useState(0);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Vals>({
    resolver: zodResolver(schema),
    defaultValues: { category: "discipline" },
  });

  const handleFile = async (f: File | null) => {
    setProbe(null); setAspect(null); setFile(f);
    if (!f) return;
    if (f.size > 200 * 1024 * 1024) { toast.error("Max 200 MB on free tier"); setFile(null); return; }
    try {
      const p = await probeVideo(f);
      const ratio = p.width / p.height;
      // 9:16 ≈ 0.5625, 16:9 ≈ 1.7778; allow ±8% tolerance
      if (Math.abs(ratio - 9/16) / (9/16) < 0.08) setAspect("9:16");
      else if (Math.abs(ratio - 16/9) / (16/9) < 0.08) setAspect("16:9");
      else {
        toast.error(`Only 9:16 or 16:9 allowed (yours: ${p.width}×${p.height})`);
        setFile(null); return;
      }
      setProbe(p);
    } catch {
      toast.error("Could not read video metadata");
      setFile(null);
    }
  };

  const onSubmit = async (vals: Vals) => {
    if (!file || !probe || !aspect) return toast.error("Pick a valid 9:16 or 16:9 video");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Sign in first");

    try {
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${u.user.id}/${Date.now()}.${ext}`;
      setProgress(15);
      const { error: upErr } = await supabase.storage.from("videos")
        .upload(path, file, { upsert: false, contentType: file.type || "video/mp4" });
      if (upErr) throw upErr;
      setProgress(75);

      const { data: pub } = supabase.storage.from("videos").getPublicUrl(path);
      const videoUrl = pub.publicUrl;

      const thumb = vals.thumbnail_url && vals.thumbnail_url.length > 0
        ? vals.thumbnail_url
        : `https://placehold.co/${aspect === "9:16" ? "405x720" : "720x405"}/2D1155/FF6B2F.png?text=${encodeURIComponent(vals.title)}`;

      const tags = vals.tags?.split(",").map(t => t.trim()).filter(Boolean).slice(0, 5) ?? [];

      const { error: insErr } = await supabase.from("videos").insert({
        user_id: u.user.id,
        title: vals.title,
        description: vals.description ?? null,
        category: vals.category,
        video_url: videoUrl,
        thumbnail_url: thumb,
        duration: Math.round(probe.duration),
        is_short: aspect === "9:16",
        tags,
        status: "active",
      });
      if (insErr) throw insErr;
      setProgress(100);
      toast.success("Live in the feed");
      nav({ to: "/feed" });
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
        <p className="text-text-secondary mb-6">Native HTML5 streaming · max 200 MB · only 9:16 or 16:9</p>

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
              <p className="font-bold">{file ? file.name : "Click or drop your MP4"}</p>
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
          <Field label="Thumbnail URL (optional)" error={errors.thumbnail_url?.message}>
            <input {...register("thumbnail_url")} placeholder="https://… (leave blank for auto)" className="w-full px-3 py-2.5" />
          </Field>
          <Field label="Tags (comma separated, max 5)">
            <input {...register("tags")} placeholder="cold, discipline, morning" className="w-full px-3 py-2.5" />
          </Field>

          {progress > 0 && (
            <div className="h-2 rounded-full bg-bg-surface overflow-hidden">
              <div className="h-full bg-brand-orange transition-all" style={{ width: `${progress}%` }} />
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
