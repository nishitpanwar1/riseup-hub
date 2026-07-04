import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-profile", user?.id] });
    if (q.data?.username) qc.invalidateQueries({ queryKey: ["profile", q.data.username] });
  };
  return { ...q, invalidate };
}
