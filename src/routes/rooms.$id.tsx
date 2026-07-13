import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Users, Flame, ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/rooms/$id")({
  component: RoomPage,
});

const checkinSchema = z.object({ content: z.string().min(3).max(600), day_number: z.coerce.number().min(1).max(365) });

function RoomPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: room } = useQuery({
    queryKey: ["room", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accountability_rooms")
        .select("*, profiles!accountability_rooms_creator_id_fkey(username, display_name, avatar_url)")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: checkins } = useQuery({
    queryKey: ["checkins", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_checkins")
        .select("*, profiles(username, display_name, avatar_url)")
        .eq("room_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: membership } = useQuery({
    queryKey: ["membership", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("room_members").select("*").eq("room_id", id).eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const join = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to join");
      const { error } = await supabase.from("room_members").insert({ room_id: id, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Joined the room"); qc.invalidateQueries({ queryKey: ["membership", id] }); qc.invalidateQueries({ queryKey: ["room", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    resolver: zodResolver(checkinSchema),
    defaultValues: { day_number: 1 },
  });

  const checkin = useMutation({
    mutationFn: async (vals: z.infer<typeof checkinSchema>) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase.from("room_checkins").insert({ room_id: id, user_id: user.id, content: vals.content, day_number: vals.day_number });
      if (error) throw error;
      await supabase.from("room_members").update({ check_in_count: (membership?.check_in_count ?? 0) + 1 }).eq("room_id", id).eq("user_id", user.id);
    },
    onSuccess: () => { toast.success("Checked in"); reset({ content: "", day_number: 1 }); qc.invalidateQueries({ queryKey: ["checkins", id] }); qc.invalidateQueries({ queryKey: ["membership", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    const ch = supabase
      .channel(`room-${id}-rt`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "accountability_rooms", filter: `id=eq.${id}` }, (payload) => {
        const row: any = payload.new;
        qc.setQueryData(["room", id], (old: any) => old ? { ...old, ...row, profiles: old.profiles } : old);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_checkins", filter: `room_id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["checkins", id] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const row: any = payload.new;
        qc.setQueryData(["room", id], (old: any) => old?.creator_id === row.id ? { ...old, profiles: { username: row.username, display_name: row.display_name, avatar_url: row.avatar_url } } : old);
        qc.setQueryData(["checkins", id], (old: any) => Array.isArray(old) ? old.map((c: any) => c.user_id === row.id ? { ...c, profiles: { username: row.username, display_name: row.display_name, avatar_url: row.avatar_url } } : c) : old);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  if (!room) return <div className="min-h-screen bg-bg-primary"><AppHeader /><div className="p-8 text-text-secondary">Loading…</div></div>;

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/rooms" className="text-text-secondary hover:text-text-primary text-sm flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" /> All rooms</Link>

        <div className="card-rise p-6 mb-6">
          <div className="flex items-center justify-between text-xs font-stat uppercase tracking-wider text-text-tertiary mb-2">
            <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-brand-orange" /> {room.challenge_days}-day</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {room.member_count}/{room.max_members}</span>
          </div>
          <h1 className="text-3xl font-black uppercase">{room.title}</h1>
          {room.description && <p className="text-text-secondary mt-2">{room.description}</p>}
          {room.profiles && (
            <div className="mt-3 flex items-center gap-2 text-xs text-text-tertiary">
              <UserAvatar src={room.profiles.avatar_url} name={room.profiles.display_name ?? room.profiles.username} className="w-6 h-6" />
              <span>by @{room.profiles.username}</span>
            </div>
          )}
          {!membership && user && (
            <button onClick={() => join.mutate()} className="btn-primary mt-4">Join challenge</button>
          )}
          {membership && (
            <p className="mt-4 text-sm text-accent-mint font-semibold">✓ You're in — {membership.check_in_count} check-ins logged</p>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* check-in form + feed */}
          <div className="space-y-4">
            {membership && (
              <form onSubmit={handleSubmit(v => checkin.mutate(v))} className="card-rise p-5 space-y-3">
                <h3 className="font-bold uppercase text-sm">Log today's check-in</h3>
                <input type="number" min={1} max={room.challenge_days ?? 7} placeholder="Day #" {...register("day_number")} className="w-full px-3 py-2.5" />
                <textarea placeholder="What did you do today?" {...register("content")} className="w-full px-3 py-2.5 min-h-[80px]" />
                <button disabled={isSubmitting} type="submit" className="btn-primary w-full">{isSubmitting ? "..." : "Submit check-in"}</button>
              </form>
            )}

            <div className="space-y-3">
              {checkins?.map((c: any) => (
                <div key={c.id} className="card-rise p-4">
                  <div className="flex items-center justify-between text-xs text-text-tertiary mb-2">
                    <span className="font-semibold text-text-secondary inline-flex items-center gap-2">
                      <UserAvatar src={c.profiles?.avatar_url} name={c.profiles?.display_name ?? c.profiles?.username} className="w-6 h-6" />
                      @{c.profiles?.username}
                    </span>
                    <span className="font-stat">Day {c.day_number}</span>
                  </div>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}
              {!checkins?.length && <p className="text-text-tertiary text-center py-8">No check-ins yet. Be first.</p>}
            </div>
          </div>

          {/* challenge checklist */}
          <aside className="card-rise p-5 h-fit lg:sticky lg:top-20">
            <h3 className="font-bold uppercase text-sm mb-3">Challenge ladder</h3>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: room.challenge_days ?? 7 }).map((_, i) => {
                const done = (membership?.check_in_count ?? 0) > i;
                return (
                  <div key={i} className={`aspect-square rounded-md flex items-center justify-center text-xs font-stat font-bold ${done ? "bg-accent-mint text-bg-primary" : "bg-bg-surface text-text-tertiary"}`}>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-text-tertiary mt-3 font-stat">{membership?.check_in_count ?? 0} / {room.challenge_days} days</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
