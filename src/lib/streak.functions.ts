import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkInStreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("check_in_streak");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return row as { current_streak: number; longest_streak: number; total_watch_days: number };
  });
