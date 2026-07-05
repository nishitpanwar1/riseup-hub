import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function useMyProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  // Realtime: react to any change to my profile row (avatar, name, handle, bio…)
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-rt-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const row: any = payload.new;
          qc.setQueryData(["my-profile", user.id], row);
          if (row?.username) qc.invalidateQueries({ queryKey: ["profile", row.username] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-profile", user?.id] });
    if (q.data?.username) qc.invalidateQueries({ queryKey: ["profile", q.data.username] });
  };
  return { ...q, invalidate };
}
