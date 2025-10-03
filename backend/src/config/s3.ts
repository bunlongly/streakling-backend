import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env';

export const s3 = new S3Client({
  region: env.AWS_REGION,
  // In prod on AWS, prefer instance/role credentials (omit credentials block)
  credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
    : undefined,
});

// Helper: build a full S3 URL for a key (public bucket only; private will 403)
export function s3ObjectUrl(key: string) {
  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${encodeURIComponent(key)}`;
}
