import 'server-only';
/**
 * Object storage with signed, expiring URLs.
 *
 * Progress photos and health documents are private by default. Nothing is ever
 * served from a guessable public path: the client asks for a signed URL, the
 * server checks permission, and the signature expires in minutes.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@gymguide/config/env';

export interface SignedUrl {
  url: string;
  expiresAt: string;
}

export interface UploadValidation {
  ok: boolean;
  reason?: string;
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const ALLOWED_DOC_TYPES = new Set(['application/pdf']);

const MAX_SIZES: Record<string, number> = {
  image: 12 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  document: 20 * 1024 * 1024,
};

/**
 * Upload validation runs before a byte is stored: type allow-list (not a deny
 * list), size cap, and an extension/MIME agreement check so a .php cannot ride
 * in claiming to be a JPEG.
 */
export function validateUpload(input: {
  filename: string;
  mimeType: string;
  byteSize: number;
  kind: 'image' | 'video' | 'document';
}): UploadValidation {
  const allowed =
    input.kind === 'image' ? ALLOWED_IMAGE_TYPES : input.kind === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_DOC_TYPES;

  if (!allowed.has(input.mimeType)) {
    return { ok: false, reason: `${input.mimeType} is not an accepted ${input.kind} type.` };
  }
  if (input.byteSize <= 0) return { ok: false, reason: 'The file is empty.' };
  if (input.byteSize > MAX_SIZES[input.kind]!) {
    return { ok: false, reason: `That file is larger than the ${Math.round(MAX_SIZES[input.kind]! / 1024 / 1024)} MB limit.` };
  }

  const extension = input.filename.split('.').pop()?.toLowerCase() ?? '';
  const expected: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'image/heic': ['heic'],
    'video/mp4': ['mp4'],
    'video/webm': ['webm'],
    'video/quicktime': ['mov'],
    'application/pdf': ['pdf'],
  };
  if (!expected[input.mimeType]?.includes(extension)) {
    return { ok: false, reason: 'The file extension does not match its contents.' };
  }
  if (/[\\/]|\.\./.test(input.filename)) {
    return { ok: false, reason: 'That filename is not allowed.' };
  }
  return { ok: true };
}

function signingSecret(): string {
  return serverEnv().SESSION_SECRET;
}

/** Build a signed URL for a private object. */
export function signedUrlFor(storageKey: string, ttlSeconds?: number): SignedUrl {
  const env = serverEnv();
  const ttl = ttlSeconds ?? env.STORAGE_SIGNED_URL_TTL_SECONDS;
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const signature = createHmac('sha256', signingSecret())
    .update(`${storageKey}:${expires}`)
    .digest('base64url');
  const params = new URLSearchParams({ key: storageKey, expires: String(expires), sig: signature });
  return {
    url: `/api/media?${params.toString()}`,
    expiresAt: new Date(expires * 1000).toISOString(),
  };
}

export function verifySignedUrl(key: string, expires: string, signature: string): { ok: boolean; reason?: string } {
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt)) return { ok: false, reason: 'Malformed link' };
  if (expiresAt * 1000 < Date.now()) return { ok: false, reason: 'This link has expired' };
  const expected = createHmac('sha256', signingSecret()).update(`${key}:${expires}`).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'Invalid link' };
  return { ok: true };
}

export interface StorageAdapter {
  key: string;
  put(storageKey: string, body: Buffer, mimeType: string): Promise<void>;
  get(storageKey: string): Promise<{ body: Buffer; mimeType: string } | null>;
}

const localAdapter: StorageAdapter = {
  key: 'local',
  async put(storageKey, body) {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { dirname, join } = await import('node:path');
    const base = serverEnv().STORAGE_LOCAL_DIR;
    const target = join(base, storageKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  },
  async get(storageKey) {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    try {
      const body = await readFile(join(serverEnv().STORAGE_LOCAL_DIR, storageKey));
      return { body, mimeType: 'application/octet-stream' };
    } catch {
      return null;
    }
  },
};

export function storageAdapter(): StorageAdapter {
  // S3 and Supabase adapters implement the same two methods; the local driver
  // keeps the demo self-contained.
  return localAdapter;
}
