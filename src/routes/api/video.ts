import { createFileRoute } from "@tanstack/react-router";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const ALLOWED_HOSTS = ["link.storjshare.io", "gateway.storjshare.io", "fytcynhzlcprytvhnmoe.supabase.co"];

function getStorjClient() {
  return new S3Client({
    region: "us1",
    endpoint: process.env.STORJ_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.STORJ_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.STORJ_SECRET_ACCESS_KEY || "",
    },
  });
}

function getStorageKey(url: URL, bucket: string) {
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const bucketIndex = parts.indexOf(bucket);
  return bucketIndex >= 0 ? parts.slice(bucketIndex + 1).join("/") : "";
}

export const Route = createFileRoute("/api/video")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const src = new URL(request.url).searchParams.get("src");
        if (!src) return new Response("Missing video source", { status: 400 });

        let upstream: URL;
        try {
          upstream = new URL(src);
        } catch {
          return new Response("Invalid video source", { status: 400 });
        }

        if (!ALLOWED_HOSTS.includes(upstream.hostname)) {
          return new Response("Video host not allowed", { status: 403 });
        }

        const bucket = process.env.STORJ_BUCKET_NAME;
        const key = bucket ? getStorageKey(upstream, bucket) : "";
        const range = request.headers.get("range") ?? undefined;
        if (key && bucket && process.env.STORJ_ACCESS_KEY_ID && process.env.STORJ_SECRET_ACCESS_KEY) {
          const obj = await getStorjClient().send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: range }));
          const headers = new Headers();
          if (obj.ContentType) headers.set("content-type", obj.ContentType);
          if (obj.ContentLength != null) headers.set("content-length", String(obj.ContentLength));
          if (obj.ContentRange) headers.set("content-range", obj.ContentRange);
          headers.set("accept-ranges", "bytes");
          headers.set("cache-control", "public, max-age=3600");
          return new Response(obj.Body as BodyInit, { status: range ? 206 : 200, headers });
        }

        const res = await fetch(upstream, { headers: range ? { range } : undefined });

        const headers = new Headers(res.headers);
        headers.set("access-control-allow-origin", "*");
        headers.set("cache-control", "public, max-age=3600");
        return new Response(res.body, { status: res.status, headers });
      },
    },
  },
});