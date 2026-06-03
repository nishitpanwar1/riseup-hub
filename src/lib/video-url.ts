// Supabase Storage public URLs and Storj raw linkshare both support Range +
// CORS, so play them directly. Only rewrite the Storj viewer form ("/s/") to
// the raw bytes form ("/raw/") for inline playback.
export function resolveVideoSrc(url: string | null | undefined) {
  if (!url) return "";
  return url.replace("/s/", "/raw/");
}
