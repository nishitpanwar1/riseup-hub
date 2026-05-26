import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search as SearchIcon, Video, Zap, Users, Grid3x3, Hash } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : "" }),
  component: SearchPage,
});

const TABS = [
  { id: "all", label: "All", icon: Grid3x3 },
  { id: "videos", label: "Videos", icon: Video },
  { id: "shorts", label: "Shorts", icon: Zap },
  { id: "channels", label: "Channels", icon: Users },
  { id: "rooms", label: "Rooms", icon: Hash },
] as const;

const CATS = ["Discipline","Fitness","Study","Entrepreneur","Mindset","Finance","Morning","Sports"];

function SearchPage() {
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ || "");
  const [tab, setTab] = useState<"all"|"videos"|"shorts"|"channels"|"rooms">("all");
  const [sort, setSort] = useState<"relevance"|"views"|"latest">("relevance");

  const trimmed = q.trim();
  const enabled = trimmed.length > 0;

  const { data: videos } = useQuery({
    queryKey: ["search-videos", trimmed, tab, sort],
    enabled,
    queryFn: async () => {
      let qb = supabase.from("videos").select("*, profiles(username, display_name)").eq("status","active")
        .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%`);
      if (tab === "shorts") qb = qb.eq("is_short", true);
      if (tab === "videos") qb = qb.eq("is_short", false);
      if (sort === "views") qb = qb.order("view_count", { ascending: false });
      else qb = qb.order("created_at", { ascending: false });
      const { data } = await qb.limit(24);
      return data ?? [];
    },
  });

  const { data: channels } = useQuery({
    queryKey: ["search-channels", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("id, username, display_name, avatar_url, follower_count, category_focus")
        .or(`username.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`)
        .order("follower_count", { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  const { data: rooms } = useQuery({
    queryKey: ["search-rooms", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase.from("accountability_rooms")
        .select("*")
        .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%`)
        .order("member_count", { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AppHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <aside className="card-rise p-4 h-fit">
          <p className="text-xs uppercase tracking-wider text-text-tertiary font-bold mb-3">Filter By</p>
          <nav className="space-y-1 mb-5">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${active ? "bg-bg-surface text-text-primary" : "text-text-secondary hover:bg-bg-surface"}`}>
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              );
            })}
          </nav>
          <p className="text-xs uppercase tracking-wider text-text-tertiary font-bold mb-2">Category</p>
          <div className="flex flex-wrap gap-1.5">
            {CATS.map(c => (
              <button key={c} onClick={() => setQ(c.toLowerCase())}
                className="px-2.5 py-1 rounded-full text-xs bg-bg-surface text-text-secondary hover:text-text-primary">
                {c}
              </button>
            ))}
          </div>
        </aside>

        <section>
          <label className="relative block mb-4">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search videos, channels, rooms…"
              className="w-full pl-10 pr-3 py-3 bg-bg-surface border border-rise rounded-xl text-sm"
            />
          </label>

          {!enabled && (
            <p className="text-text-tertiary text-center py-16">Start typing to search across the platform.</p>
          )}

          {enabled && (
            <>
              <div className="flex gap-2 mb-5">
                {(["relevance","views","latest"] as const).map(s => (
                  <button key={s} onClick={() => setSort(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold ${sort===s ? "bg-white text-black" : "bg-bg-surface text-text-secondary"}`}>
                    {s === "relevance" ? "All" : s === "views" ? "Most viewed" : "Latest"}
                  </button>
                ))}
              </div>

              {(tab === "all" || tab === "channels") && (channels?.length ?? 0) > 0 && (
                <>
                  <h3 className="text-xs uppercase tracking-wider text-text-tertiary font-bold mb-2">Top Channels</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    {channels!.map((c: any) => (
                      <Link key={c.id} to="/$username" params={{ username: c.username }} className="card-rise p-4 text-center hover:border-brand-purple">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} className="w-12 h-12 mx-auto rounded-full object-cover mb-2" alt="" />
                        ) : (
                          <div className="w-12 h-12 mx-auto rounded-full bg-brand-purple flex items-center justify-center font-black mb-2">
                            {c.username.slice(0,2).toUpperCase()}
                          </div>
                        )}
                        <p className="font-bold text-sm">{c.display_name || c.username}</p>
                        <p className="text-xs text-text-tertiary font-stat">{c.follower_count ?? 0} followers</p>
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {(tab === "all" || tab === "videos" || tab === "shorts") && (
                <>
                  <h3 className="text-xs uppercase tracking-wider text-text-tertiary font-bold mb-2">Videos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {(videos ?? []).map((v: any) => (
                      <Link key={v.id} to="/watch/$id" params={{ id: v.id }} className="card-rise overflow-hidden hover:border-brand-purple">
                        <div className="aspect-video bg-black relative">
                          <img src={v.thumbnail_url} className="w-full h-full object-cover" alt={v.title} />
                          <span className="absolute bottom-2 right-2 text-xs bg-black/80 px-1.5 py-0.5 rounded font-stat">{Math.floor((v.duration||0)/60)}:{String((v.duration||0)%60).padStart(2,"0")}</span>
                        </div>
                        <div className="p-3">
                          <p className="font-bold text-sm line-clamp-2">{v.title}</p>
                          <p className="text-xs text-text-tertiary mt-1">{v.profiles?.display_name || v.profiles?.username} · {v.view_count ?? 0} views</p>
                        </div>
                      </Link>
                    ))}
                    {(videos?.length ?? 0) === 0 && <p className="text-text-tertiary col-span-full">No videos found.</p>}
                  </div>
                </>
              )}

              {(tab === "all" || tab === "rooms") && (rooms?.length ?? 0) > 0 && (
                <>
                  <h3 className="text-xs uppercase tracking-wider text-text-tertiary font-bold mb-2">Rooms</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {rooms!.map((r: any) => (
                      <Link key={r.id} to="/rooms/$id" params={{ id: r.id }} className="card-rise p-4 hover:border-brand-purple">
                        <p className="font-bold">{r.title}</p>
                        <p className="text-xs text-text-secondary line-clamp-2 mt-1">{r.description}</p>
                        <p className="text-xs text-text-tertiary mt-2 font-stat">{r.member_count} members · {r.challenge_days}d challenge</p>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
