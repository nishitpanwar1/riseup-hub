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

const schema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(["discipline","fitness","study","entrepreneur","mindset","finance","morning","sports"]),
  thumbnail_url: z.string().url("Provide a thumbnail image URL"),
  is_short: z.boolean(),
  tags: z.string().optional(),
});
type Vals = z.infer<typeof schema>;

function UploadPage() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Vals>({
    resolver: zodResolver(schema),
    defaultValues: { is_short: true, category: "discipline" },
  });

  const onSubmit = async (vals: Vals) => {
    if (!file) return toast.error("Pick a video file");
    if (file.size > 200 * 1024 * 1024) return toast.error("Max 200 MB (free tier)");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Sign in");

    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${u.user.id}/${Date.now()}.${ext}`;
      setProgress(10);
      const { error: upErr } = await supabase.storage.from("videos").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      setProgress(70);

      const { data: pub } = supabase.storage.from("videos").getPublicUrl(path);
      const videoUrl = pub.publicUrl;

      // Probe duration via temp <video>
      const duration = await probeDuration(file);

      const tags = vals.tags?.split(",").map(t => t.trim()).filter(Boolean).slice(0, 5) ?? [];

      const { error: insErr } = await supabase.from("videos").insert({
        user_id: u.user.id,
        title: vals.title,
        description: vals.description ?? null,
        category: vals.category,
        video_url: videoUrl,
        thumbnail_url: vals.thumbnail_url,
        duration: Math.round(duration),
        is_short: vals.is_short,
        tags,
        status: "active",
      });
      if (insErr) throw insErr;
      setProgress(100);
      toast.success("Video published");
      nav({ to: "/feed" });
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-black uppercase mb-1">Studio · upload</h1>
        <p className="text-text-secondary mb-6">Native HTML5 streaming · max 200 MB · MP4 recommended</p>

        <form onSubmit={handleSubmit(onSubmit)} className="card-rise p-6 space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-text-secondary font-semibold">Video file</span>
            <div className="mt-2 border-2 border-dashed border-rise rounded-xl p-8 text-center bg-bg-surface hover:border-brand-purple cursor-pointer relative">
              <input type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] ?? null)} className="absolute inset-0 opacity-0 cursor-pointer" />
              <Film className="w-10 h-10 text-brand-orange mx-auto mb-2" />
              <p className="font-bold">{file ? file.name : "Click or drop your MP4"}</p>
              {file && <p className="text-xs text-text-tertiary mt-1 font-stat">{(file.size / 1024 / 1024).toFixed(1)} MB</p>}
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
              {["discipline","fitness","study","entrepreneur","mindset","finance","morning","sports"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Thumbnail URL" error={errors.thumbnail_url?.message}>
            <input {...register("thumbnail_url")} placeholder="https://…" className="w-full px-3 py-2.5" />
          </Field>
          <Field label="Tags (comma separated, max 5)">
            <input {...register("tags")} placeholder="cold, discipline, morning" className="w-full px-3 py-2.5" />
          </Field>
          <label className="flex items-center gap-3 select-none">
            <input type="checkbox" {...register("is_short")} className="w-4 h-4" />
            <span className="text-sm">Vertical 9:16 short (shows in Shorts feed)</span>
          </label>

          {progress > 0 && progress < 100 && (
            <div className="h-2 rounded-full bg-bg-surface overflow-hidden">
              <div className="h-full bg-brand-orange transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}

          <button disabled={isSubmitting} type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2">
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

function probeDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration || 0); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}
