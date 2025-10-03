import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { s3, s3ObjectUrl } from '../config/s3';
import { env } from '../config/env';

export type UploadCategory = 'digitalcard' | 'portfolio' | 'profile';
export type UploadPurpose = 'avatar' | 'banner' | 'cover' | 'media'; // extend as needed

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif'
]);

/**
 * Key layout (ALL under streakling/):
 * streakling/<category>/<purpose>/user_<uid>/<uuid>.<ext>
 */
export function makeObjectKey(params: {
  userId: string;
  category: UploadCategory;
  purpose: UploadPurpose;
  ext?: string;
}) {
  const { userId, category, purpose, ext } = params;
  const safeExt = (ext ?? 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `${
    env.AWS_S3_BASE_PREFIX
  }/${category}/${purpose}/user_${userId}/${randomUUID()}.${safeExt}`;
}

export async function getPresignedPutUrl(params: {
  userId: string;
  category: UploadCategory;
  purpose: UploadPurpose;
  contentType: string;
  sizeBytes?: number;
  ext?: string;
  expiresSeconds?: number; // default 8min
}) {
  const { userId, category, purpose, contentType, sizeBytes, ext } = params;

  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error('Unsupported content type');
  }
  if (sizeBytes && sizeBytes > 10 * 1024 * 1024) {
    throw new Error('File too large (max 10MB)');
  }

  const key = makeObjectKey({ userId, category, purpose, ext });
  const cmd = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType
    // ServerSideEncryption: 'AES256', // opt-in
  });

  const uploadUrl = await getSignedUrl(s3, cmd, {
    expiresIn: params.expiresSeconds ?? 480
  });
  const url = s3ObjectUrl(key);

  return { key, uploadUrl, url };
}
