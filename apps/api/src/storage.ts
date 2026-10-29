import { AwsClient } from 'aws4fetch';
import { S3Client } from 'bun';

/** Where attachment bytes live. S3-compatible in development and production; in memory for tests. */
export interface Storage {
  put(key: string, body: ArrayBuffer, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  /** A short-lived link to download the object. */
  url(key: string, fileName: string): string;
}

export interface S3Options {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export async function createS3Storage(options: S3Options): Promise<Storage> {
  // Bun's S3 client cannot sign bucket-level requests, so the bucket is created with a signed PUT.
  // Creating an existing bucket you own succeeds, which makes this safe on every start.
  const signer = new AwsClient({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    service: 's3',
    region: options.region,
  });
  const created = await signer.fetch(`${options.endpoint.replace(/\/$/, '')}/${options.bucket}`, {
    method: 'PUT',
  });
  if (!created.ok && created.status !== 409) {
    throw new Error(`could not create bucket ${options.bucket}: ${created.status}`);
  }

  const s3 = new S3Client(options);
  return {
    async put(key, body, contentType) {
      await s3.write(key, body, { type: contentType });
    },
    async remove(key) {
      await s3.delete(key);
    },
    url: (key) => s3.presign(key, { expiresIn: 600 }),
  };
}

export function createMemoryStorage(): Storage & {
  objects: Map<string, { body: ArrayBuffer; contentType: string }>;
} {
  const objects = new Map<string, { body: ArrayBuffer; contentType: string }>();
  return {
    objects,
    async put(key, body, contentType) {
      objects.set(key, { body, contentType });
    },
    async remove(key) {
      objects.delete(key);
    },
    url: (key, fileName) => `memory://${key}?name=${encodeURIComponent(fileName)}`,
  };
}
