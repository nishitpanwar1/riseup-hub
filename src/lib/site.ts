/** Stable absolute origin used for shareable social preview images. */
export const SITE_URL = "https://project--773a961b-d8c9-4b73-b9e5-527d010a0611.lovable.app";

export function ogImageUrl(params: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  return `${SITE_URL}/api/public/og?${q.toString()}`;
}
