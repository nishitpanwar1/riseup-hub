import { useEffect, useRef, useState } from "react";
import { X, Send } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Comment = {
  id: string;
  body: string;
  user_id: string;
  created_at: string;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
};

export function ShortsComments({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // load + realtime subscribe
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("video_comments")
        .select("id, body, user_id, created_at, profiles(username, display_name, avatar_url)")
        .eq("video_id", videoId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (alive && data) setComments(data as unknown as Comment[]);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`comments-${videoId}-${Math.random().toString(36).slice(2, 9)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "video_comments", filter: `video_id=eq.${videoId}` },
        async (payload) => {
          const row: any = payload.new;
          // Fetch joined profile
          const { data: prof } = await supabase
            .from("profiles")
            .select("username, display_name, avatar_url")
            .eq("id", row.user_id)
            .maybeSingle();
          setComments((prev) => {
            if (prev.some((c) => c.id === row.id)) return prev;
            return [{ ...row, profiles: prof } as Comment, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "video_comments", filter: `video_id=eq.${videoId}` },
        (payload) => {
          const old: any = payload.old;
          setComments((prev) => prev.filter((c) => c.id !== old.id));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const row: any = payload.new;
          setComments((prev) => prev.map((c) => c.user_id === row.id ? {
            ...c,
            profiles: { username: row.username, display_name: row.display_name, avatar_url: row.avatar_url },
          } : c));
        }
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [videoId]);

  const post = async () => {
    if (!user) return toast.error("Sign in to comment");
    const body = text.trim();
    if (!body || posting) return;
    setPosting(true);
    const tempId = `tmp-${Date.now()}`;
    const { data: me } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    setComments((prev) => [
      { id: tempId, body, user_id: user.id, created_at: new Date().toISOString(), profiles: me as any },
      ...prev,
    ]);
    setText("");
    const { data: inserted, error } = await supabase
      .from("video_comments")
      .insert({ video_id: videoId, user_id: user.id, body })
      .select("id, body, user_id, created_at, profiles(username, display_name, avatar_url)")
      .maybeSingle();
    setPosting(false);
    if (error) {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      return toast.error(error.message);
    }
    setComments((prev) => {
      const withoutTemp = prev.filter((c) => c.id !== tempId && c.id !== inserted?.id);
      return inserted ? [inserted as unknown as Comment, ...withoutTemp] : withoutTemp;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full sm:max-w-md h-[70dvh] sm:h-[80vh] sm:rounded-2xl rounded-t-2xl bg-bg-primary border-t sm:border border-rise flex flex-col text-text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-rise">
          <h3 className="font-display font-black uppercase text-sm">Comments · {comments.length}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-bg-surface flex items-center justify-center" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading ? (
            <p className="text-sm text-text-tertiary">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-text-tertiary">Be the first to comment.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-bg-surface border border-brand-purple flex items-center justify-center overflow-hidden shrink-0 text-xs font-bold">
                  {c.profiles?.avatar_url ? (
                    <img src={c.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (c.profiles?.display_name?.[0] ?? "?").toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold">@{c.profiles?.username ?? "user"}</div>
                  <div className="text-sm whitespace-pre-wrap break-words">{c.body}</div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-rise flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") post(); }}
            placeholder={user ? "Add a comment" : "Sign in to comment"}
            disabled={!user}
            className="flex-1 px-3 py-2 rounded-full bg-bg-surface border border-rise text-sm"
          />
          <button
            onClick={post}
            disabled={!user || !text.trim() || posting}
            className="btn-primary py-2 px-4 inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
