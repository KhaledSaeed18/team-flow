import { AwsClient } from 'aws4fetch';
import { S3Client } from 'bun';

/** Raster images a browser can safely show inline. Anything else (SVG and HTML included) could run script. */
const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']);

/**
 * The headers an object is stored with. Uploaders choose the content type, so it is never trusted: only known
 * raster images are served as themselves and inline; everything else is served as an opaque download under its
 * own file name.
 */
export function servingHeaders(contentType: string, fileName: string) {
  const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  const inline = INLINE_TYPES.has(type);
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return {
    type: inline ? type : 'application/octet-stream',
    contentDisposition: inline
      ? 'inline'
      : `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  };
}

/** Where attachment bytes live. S3-compatible in development and production; in memory for tests. */
export interface Storage {
  put(
    key: string,
    body: ArrayBuffer,
    file: { contentType: string; fileName: string },
  ): Promise<void>;
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
    async put(key, body, { contentType, fileName }) {
      await s3.write(key, body, servingHeaders(contentType, fileName));
    },
    async remove(key) {
      await s3.delete(key);
    },
    url: (key) => s3.presign(key, { expiresIn: 600 }),
  };
}

type Stored = { body: ArrayBuffer } & ReturnType<typeof servingHeaders>;

export function createMemoryStorage(): Storage & { objects: Map<string, Stored> } {
  const objects = new Map<string, Stored>();
  return {
    objects,
    async put(key, body, { contentType, fileName }) {
      objects.set(key, { body, ...servingHeaders(contentType, fileName) });
    },
    async remove(key) {
      objects.delete(key);
    },
    url: (key, fileName) => `memory://${key}?name=${encodeURIComponent(fileName)}`,
  };
}
