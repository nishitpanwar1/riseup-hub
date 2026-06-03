// Storj raw linkshare URLs support Range + CORS, so play them directly
// (the previous /api/video proxy added latency and could stall on the Worker).
export function resolveVideoSrc(url: string | null | undefined) {
  if (!url) return "";
  return url.replace("/s/", "/raw/");
}
