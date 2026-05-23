import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Min 6 characters"),
  displayName: z.string().min(2, "Min 2 characters").or(z.literal("")).optional(),
});
type FormVals = z.infer<typeof schema>;

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const nav = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", displayName: "" },
  });

  const onSubmit = async (vals: FormVals) => {
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: vals.email,
          password: vals.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: vals.displayName ?? vals.email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Account created. Check your email to verify, then sign in.");
          return;
        }
        toast.success("Account created. Welcome to the arena.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: vals.email,
          password: vals.password,
        });
        if (error) throw error;
        if (!data.session) throw new Error("Sign-in needs email verification first.");
        toast.success("Welcome back.");
      }
      nav({ to: "/feed", replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Auth failed");
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/feed" });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4 gradient-hero">
      <div className="card-rise p-8 w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <Flame className="w-6 h-6 text-brand-orange" />
          <span className="font-display text-2xl font-black tracking-tight">RISEUP</span>
        </Link>
        <h1 className="text-2xl font-black uppercase text-center">
          {mode === "signin" ? "Enter the arena" : "Join the rise"}
        </h1>
        <p className="text-center text-text-secondary text-sm mt-1">
          {mode === "signin" ? "Sign in to continue your streak." : "Create an account and start day 1."}
        </p>

        <button onClick={google} className="btn-ghost w-full mt-6 flex items-center justify-center gap-2">
          <GoogleIcon /> Continue with Google
        </button>

        <div className="flex items-center gap-3 my-5 text-xs text-text-tertiary">
          <div className="flex-1 h-px bg-[#4A2D7A]" /> OR <div className="flex-1 h-px bg-[#4A2D7A]" />
        </div>

        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {mode === "signup" && (
            <Field label="Display name" error={errors.displayName?.message}>
              <input {...register("displayName")} placeholder="Your name" className="w-full px-3 py-2.5" />
            </Field>
          )}
          <Field label="Email" error={errors.email?.message}>
            <input type="email" {...register("email")} placeholder="you@rise.up" className="w-full px-3 py-2.5" />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <input type="password" {...register("password")} placeholder="••••••••" className="w-full px-3 py-2.5" />
          </Field>
          <button disabled={isSubmitting} type="submit" className="btn-primary w-full mt-2">
            {isSubmitting ? "..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-center text-sm text-text-secondary mt-5 hover:text-text-primary"
        >
          {mode === "signin" ? "No account? Create one →" : "Already have an account? Sign in →"}
        </button>
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z" opacity=".9"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" opacity=".8"/><path fill="#fff" d="M5.84 14.12A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.46.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.77.42 3.44 1.18 4.96l3.66-2.84z" opacity=".7"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" opacity=".95"/></svg>
  );
}
