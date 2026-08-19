import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * R2 is S3-compatible, so the AWS SDK's S3Client works against it directly —
 * just point endpoint at the account's R2 URL and use the R2 API token as
 * the access key pair. No separate Cloudflare SDK needed.
 */
function getClient(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function isR2Configured(): boolean {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME);
}

/**
 * Uploads a file to the configured bucket under `key` and returns that key.
 * Returns null (never throws) on missing config or any upload failure, so
 * callers can treat storage as best-effort and keep working without it.
 */
export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string | null> {
  const client = getClient();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!client || !bucket) return null;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  } catch {
    return null;
  }
}
