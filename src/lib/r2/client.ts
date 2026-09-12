import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { hasR2Env } from "@/lib/env";

let r2Client: S3Client | null = null;

function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!hasR2Env() || !accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 is not configured.");
  }

  return {
    bucket,
    endpoint:
      process.env.R2_ENDPOINT ??
      `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  };
}

function client() {
  if (r2Client) return r2Client;
  const { endpoint, credentials } = config();
  r2Client = new S3Client({
    region: "auto",
    endpoint,
    credentials,
  });
  return r2Client;
}

export type UploadObjectInput = {
  key: string;
  body: PutObjectCommandInput["Body"];
  contentType?: string;
  metadata?: Record<string, string>;
};

export async function uploadObject({
  key,
  body,
  contentType,
  metadata,
}: UploadObjectInput) {
  const { bucket } = config();
  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    }),
  );
  return { key };
}

export async function getObject(key: string) {
  const { bucket } = config();
  return client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
}

export async function getObjectBytes(key: string) {
  const response = await getObject(key);
  if (!response.Body) throw new Error("R2 returned an empty object body.");
  return response.Body.transformToByteArray();
}

export async function deleteObject(key: string) {
  const { bucket } = config();
  await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function objectExists(key: string) {
  const { bucket } = config();
  try {
    await client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (status === 404) return false;
    throw error;
  }
}

export async function getSignedUploadUrl(
  key: string,
  contentType = "application/pdf",
  expiresIn = 600,
) {
  const { bucket } = config();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client(), command, { expiresIn });
}

export async function getSignedDownloadUrl(key: string, expiresIn = 300) {
  const { bucket } = config();
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn },
  );
}
