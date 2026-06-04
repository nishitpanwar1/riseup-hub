// Lovable Cloud Storage public URLs play directly. Older Storj URLs in the
// database may be expired signed gateway links, so route only those through the
// server proxy where the app can recover the object with the stored S3 keys.
export function resolveVideoSrc(url: string | null | undefined) {
  if (!url) return "";
  const normalized = url.replace("/s/", "/raw/");
  try {
    const host = new URL(normalized).hostname;
    if (host === "link.storjshare.io" || host === "gateway.storjshare.io") {
      return `/api/video?src=${encodeURIComponent(normalized)}`;
    }
  } catch {
    return normalized;
  }
  return normalized;
}
