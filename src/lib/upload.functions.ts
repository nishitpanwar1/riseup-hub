import { createServerFn } from "@tanstack/react-start";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

export const getStorjUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { filename: string; fileType: string; folder?: string }) => input)
  .handler(async ({ data }) => {
    const bucket = process.env.STORJ_BUCKET_NAME;
    const linkshare = process.env.STORJ_LINKSHARE_URL;
    if (!bucket || !linkshare) throw new Error("Storj env vars missing");

    const ext = (data.filename.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
    const id = crypto.randomUUID();
    const folder = (data.folder || "shorts").replace(/[^a-z0-9/_-]/gi, "");
    const storageKey = `${folder}/${id}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: data.fileType || "video/mp4",
    });

    const uploadUrl = await getSignedUrl(getStorjClient(), command, { expiresIn: 900 });
    // Linkshare URLs the user provides may look like:
    //   https://link.storjshare.io/s/<key>/<bucket>   (sharing page)
    //   https://link.storjshare.io/raw/<key>/<bucket> (raw bytes)
    // We want raw bytes for <video> playback.
    const base = linkshare.replace("/s/", "/raw/").replace(/\/$/, "");
    const playbackUrl = `${base}/${storageKey}`;
    return { uploadUrl, playbackUrl, storageKey };
  });
