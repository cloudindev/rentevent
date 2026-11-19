import "server-only";
import { blobs, eq, systemDb } from "@rentevent/db";
import { env } from "../env";

/**
 * Object storage. S3-compatible (EU region) when S3_BUCKET is set; otherwise
 * blobs are stored in PostgreSQL so the app works anywhere without keys.
 * Keys are always prefixed with the tenant id: `${tenantId}/...`.
 */
async function s3() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: env.s3!.region,
    endpoint: env.s3!.endpoint,
    forcePathStyle: Boolean(env.s3!.endpoint),
    credentials: { accessKeyId: env.s3!.accessKeyId, secretAccessKey: env.s3!.secretAccessKey },
  });
}

export async function putObject(key: string, body: Buffer | Uint8Array, contentType: string) {
  if (env.s3) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await s3()).send(new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, Body: body, ContentType: contentType }));
    return { key, size: body.byteLength };
  }
  const data = Buffer.from(body).toString("base64");
  await systemDb()
    .insert(blobs)
    .values({ key, contentType, size: body.byteLength, data })
    .onConflictDoUpdate({ target: blobs.key, set: { contentType, size: body.byteLength, data } });
  return { key, size: body.byteLength };
}

export async function getObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  if (env.s3) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      const out = await (await s3()).send(new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }));
      const bytes = await out.Body!.transformToByteArray();
      return { body: Buffer.from(bytes), contentType: out.ContentType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }
  const [row] = await systemDb().select().from(blobs).where(eq(blobs.key, key));
  return row ? { body: Buffer.from(row.data, "base64"), contentType: row.contentType } : null;
}

export async function deleteObject(key: string) {
  if (env.s3) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await (await s3()).send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }));
    return;
  }
  await systemDb().delete(blobs).where(eq(blobs.key, key));
}

/** Public URL served by /api/files (auth-checked by tenant prefix). */
export const fileUrl = (key: string) => `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
