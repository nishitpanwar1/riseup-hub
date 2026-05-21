import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Users, Flame, Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/rooms/")({
  component: RoomsPage,
});

const newRoomSchema = z.object({
  title: z.string().min(3).max(60),
  description: z.string().max(300).optional(),
  challenge_days: z.coerce.number().min(1).max(90),
});

function RoomsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(newRoomSchema),
    defaultValues: { challenge_days: 7 },
  });

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accountability_rooms")
        .select("*, profiles!accountability_rooms_creator_id_fkey(username, display_name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (vals: z.infer<typeof newRoomSchema>) => {
      if (!user) throw new Error("Sign in first");
      const { data, error } = await supabase.from("accountability_rooms").insert({
        creator_id: user.id, title: vals.title, description: vals.description ?? null, challenge_days: vals.challenge_days,
      }).select().single();
      if (error) throw error;
      await supabase.from("room_members").insert({ room_id: data.id, user_id: user.id });
      return data;
    },
    onSuccess: () => { toast.success("Room created"); setOpen(false); reset(); qc.invalidateQueries({ queryKey: ["rooms"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-4xl font-black uppercase">Accountability rooms</h1>
            <p className="text-text-secondary mt-1">Public challenges. Daily check-ins. Show up or get cut.</p>
          </div>
          {user && (
            <button onClick={() => setOpen(o => !o)} className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> New room
            </button>
          )}
        </div>

        {open && (
          <form onSubmit={handleSubmit(v => create.mutate(v))} className="card-rise p-5 mb-6 space-y-3">
            <h3 className="font-black uppercase">New challenge room</h3>
            <input placeholder="Room title (e.g. 30 days cold showers)" {...register("title")} className="w-full px-3 py-2.5" />
            {errors.title && <p className="text-xs text-accent-red">{errors.title.message}</p>}
            <textarea placeholder="Description" {...register("description")} className="w-full px-3 py-2.5 min-h-[80px]" />
            <input type="number" min={1} max={90} placeholder="Challenge days" {...register("challenge_days")} className="w-full px-3 py-2.5" />
            <button disabled={isSubmitting} type="submit" className="btn-primary w-full">{isSubmitting ? "..." : "Create room"}</button>
          </form>
        )}

        {isLoading ? <p className="text-text-secondary">Loading…</p> : !rooms?.length ? (
          <div className="card-rise p-12 text-center">
            <p className="text-text-secondary">No active rooms yet.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((r: any) => (
              <Link key={r.id} to="/rooms/$id" params={{ id: r.id }} className="card-rise p-5 hover:border-brand-purple block">
                <div className="flex items-center justify-between text-xs font-stat text-text-tertiary uppercase tracking-wider mb-2">
                  <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-brand-orange" /> {r.challenge_days}-day</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {r.member_count}/{r.max_members}</span>
                </div>
                <h3 className="font-display font-black text-xl uppercase leading-tight">{r.title}</h3>
                {r.description && <p className="text-sm text-text-secondary mt-2 line-clamp-3">{r.description}</p>}
                {r.profiles && <p className="text-xs text-text-tertiary mt-3">by @{r.profiles.username}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
