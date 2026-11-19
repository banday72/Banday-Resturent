import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { publicToken } from "@/lib/utils";

const allowedExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function extensionForMime(mime: string) {
  return allowedExtensions[mime] ?? null;
}

export async function saveUpload(file: File, folder: string) {
  const extension = extensionForMime(file.type);
  if (!extension) throw new Error("Unsupported file type");
  if (file.size > 5 * 1024 * 1024) throw new Error("File is larger than 5MB");

  const name = `${publicToken()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (process.env.STORAGE_DRIVER === "s3") {
    const required = ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
    if (required.some((key) => !process.env[key])) throw new Error("S3 storage is not configured");
    const client = new S3Client({
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `${folder}/${name}`,
        Body: bytes,
        ContentType: file.type,
      }),
    );
    const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, "");
    return endpoint
      ? `${endpoint}/${process.env.S3_BUCKET}/${folder}/${name}`
      : `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${folder}/${name}`;
  }

  const directory = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, name), bytes);
  return `/uploads/${folder}/${name}`;
}
