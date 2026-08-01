// RiseUp recommendation engine.
//
// Inspired by the way large video platforms work: a two-stage pipeline of
// candidate generation (cheap filtering down to a shortlist from affinity +
// freshness + popularity) followed by ranking (a scored model that predicts
// how likely you are to watch). Shorts use a different objective than
// long-form: swipe-through and loop rate instead of click-through.

export type Signals = {
  catScore: Map<string, number>;
  creatorScore: Map<string, number>;
  seenIds: Set<string>;
  /** average watch-through ratio per category, 0..1 */
  retention: Map<string, number>;
  subscriptions: Set<string>;
};

export const emptySignals = (): Signals => ({
  catScore: new Map(),
  creatorScore: new Map(),
  seenIds: new Set(),
  retention: new Map(),
  subscriptions: new Set(),
});

export type Candidate = {
  id: string;
  category: string;
  user_id: string;
  created_at: string;
  view_count?: number | null;
  like_count?: number | null;
  comment_count?: number | null;
  save_count?: number | null;
  is_short?: boolean | null;
  duration?: number | null;
};

const hoursSince = (iso: string) => Math.max(0.25, (Date.now() - new Date(iso).getTime()) / 36e5);

/** Stage 1 — Candidate generation: shortlist by affinity, freshness, reach. */
export function generateCandidates<T extends Candidate>(pool: T[], signals: Signals, limit = 120): T[] {
  if (pool.length <= limit) return pool;
  const scored = pool.map((v) => {
    const affinity =
      (signals.catScore.get(v.category) ?? 0) * 1.0 +
      (signals.creatorScore.get(v.user_id) ?? 0) * 1.5 +
      (signals.subscriptions.has(v.user_id) ? 8 : 0);
    const reach = Math.log10((v.view_count ?? 0) + 1);
    const fresh = Math.exp(-hoursSince(v.created_at) / 72);
    return { v, s: Math.log10(affinity + 1) * 3 + reach + fresh * 2 };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.v);
}

/**
 * Tiered rollout for brand-new uploads: a fresh video with no data still gets
 * distribution — first to subscribers, then to topic viewers, then broadly —
 * and the boost decays as the video accumulates real signals.
 */
function coldStartBoost(v: Candidate, signals: Signals) {
  const hours = hoursSince(v.created_at);
  if (hours > 96) return 0;
  const views = v.view_count ?? 0;
  const explored = Math.min(1, views / 250);
  const tier = signals.subscriptions.has(v.user_id)
    ? 3.2                                        // tier 1: core circle
    : (signals.catScore.get(v.category) ?? 0) > 0
      ? 1.8                                      // tier 2: topic audience
      : 0.9;                                     // tier 3: broad test
  return tier * (1 - explored) * Math.exp(-hours / 36);
}

/** Stage 2 — Ranking for long-form: predicted click + predicted watch time. */
export function scoreLongForm(v: Candidate, signals: Signals) {
  const views = v.view_count ?? 0;
  const likes = v.like_count ?? 0;
  const comments = v.comment_count ?? 0;
  const saves = v.save_count ?? 0;

  // Predicted click-through proxy: engagement rate beats raw popularity.
  const engagementRate = views > 0 ? (likes * 1 + comments * 2 + saves * 3) / (views + 10) : 0;
  const popularity = Math.log10(views + 1) * 0.55;
  const quality = Math.min(1.6, engagementRate * 6);

  // Predicted watch time proxy: category retention history.
  const retention = signals.retention.get(v.category) ?? 0.35;
  const watchTime = retention * 1.4;

  const freshness = Math.exp(-hoursSince(v.created_at) / 48) * 1.4;
  const catBoost = Math.log10((signals.catScore.get(v.category) ?? 0) + 1) * 2.4;
  const creatorBoost = Math.log10((signals.creatorScore.get(v.user_id) ?? 0) + 1) * 3.0;
  const subBoost = signals.subscriptions.has(v.user_id) ? 1.6 : 0;
  const seenPenalty = signals.seenIds.has(v.id) ? -2.6 : 0;
  const explore = Math.random() * 0.4; // keeps the feed from ossifying

  return (
    popularity + quality + watchTime + freshness + catBoost + creatorBoost +
    subBoost + seenPenalty + coldStartBoost(v, signals) + explore
  );
}

/**
 * Ranking for Shorts: there is no thumbnail click, so click-through is
 * irrelevant. What matters is whether people stayed instead of swiping away,
 * and whether they looped.
 */
export function scoreShort(v: Candidate, signals: Signals) {
  const views = v.view_count ?? 0;
  const likes = v.like_count ?? 0;
  const comments = v.comment_count ?? 0;

  // Stay-rate proxy: likes/comments per view answer "did they swipe away?".
  const stayRate = views > 0 ? (likes * 2 + comments * 3) / (views + 8) : 0;
  const loopProxy = Math.min(1.5, (signals.retention.get(v.category) ?? 0.4) * 2);
  const reach = Math.log10(views + 1) * 0.4;
  const freshness = Math.exp(-hoursSince(v.created_at) / 24) * 1.8; // shorts decay faster
  const catBoost = Math.log10((signals.catScore.get(v.category) ?? 0) + 1) * 2.0;
  const creatorBoost = Math.log10((signals.creatorScore.get(v.user_id) ?? 0) + 1) * 2.2;
  const seenPenalty = signals.seenIds.has(v.id) ? -3.2 : 0;
  const explore = Math.random() * 0.6; // shorts lean harder on discovery

  return (
    Math.min(2.5, stayRate * 8) + loopProxy + reach + freshness + catBoost +
    creatorBoost + seenPenalty + coldStartBoost(v, signals) + explore
  );
}

export function rankFeed<T extends Candidate>(pool: T[], signals: Signals, kind: "long" | "short"): T[] {
  const scorer = kind === "short" ? scoreShort : scoreLongForm;
  const candidates = generateCandidates(pool, signals, kind === "short" ? 80 : 120);
  return candidates
    .map((v) => ({ v, s: scorer(v, signals) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.v);
}
