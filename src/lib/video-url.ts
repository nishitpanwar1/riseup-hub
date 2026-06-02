const STORJ_HOST_MARKERS = ["storjshare.io", "storj.io"];

export function resolveVideoSrc(url: string | null | undefined) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (STORJ_HOST_MARKERS.some((marker) => parsed.hostname.includes(marker))) {
      return `/api/video?src=${encodeURIComponent(url)}`;
    }
  } catch {
    return url;
  }
  return url;
}