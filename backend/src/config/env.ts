import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',

  // Server
  PORT: parseInt(process.env.PORT ?? '4000', 10),

  // CORS
  CORS_ORIGIN: required('CORS_ORIGIN'),

  // DB
  DATABASE_URL: required('DATABASE_URL'),

  // Clerk
  CLERK_PUBLISHABLE_KEY: required('CLERK_PUBLISHABLE_KEY'),
  CLERK_SECRET_KEY: required('CLERK_SECRET_KEY'),

  // Session cookie
  SESSION_COOKIE_NAME: required('SESSION_COOKIE_NAME'),
  SESSION_SECRET: required('SESSION_SECRET'),
  COOKIE_DOMAIN: required('COOKIE_DOMAIN'),
  COOKIE_SECURE: (process.env.COOKIE_SECURE ?? 'false') === 'true',
  COOKIE_SAMESITE: (process.env.COOKIE_SAMESITE ?? 'lax') as
    | 'lax' | 'strict' | 'none',

  // S3
  AWS_REGION: required('AWS_REGION'),
  AWS_S3_BUCKET: required('AWS_S3_BUCKET'),
  AWS_S3_BASE_PREFIX: (process.env.AWS_S3_BASE_PREFIX ?? 'streakling').replace(/\/+$/,''),
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
};
