// src/config/env.ts
import dotenvFlow from 'dotenv-flow';
import { cleanEnv, str, bool, num, url, makeValidator } from 'envalid';

// Load .env* first
dotenvFlow.config({
  node_env: process.env.NODE_ENV ?? 'development',
  silent: true
});

// Treat empty COOKIE_DOMAIN as unset
if ((process.env.COOKIE_DOMAIN ?? '').trim() === '') {
  delete process.env.COOKIE_DOMAIN;
}

// Validators
const cookieDomain = makeValidator((input?: string) => {
  if (!input) return undefined as unknown as string; // optional
  const trimmed = input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/:\d+$/, '');
  if (!trimmed || /[\/\s]/.test(trimmed)) {
    throw new Error(
      'COOKIE_DOMAIN must be a bare hostname (e.g., ".streakling.com" or "api.streakling.com")'
    );
  }
  return trimmed;
});

const sameSite = makeValidator((v?: string) => {
  const x = (v ?? 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(x))
    throw new Error('COOKIE_SAMESITE must be lax|strict|none');
  return x as 'lax' | 'strict' | 'none';
});

const e = cleanEnv(process.env, {
  NODE_ENV: str({ default: 'development' }),
  PORT: num({ default: 4000 }),

  CORS_ORIGIN: url(),

  DATABASE_URL: str(),

  CLERK_PUBLISHABLE_KEY: str(),
  CLERK_SECRET_KEY: str(),

  SESSION_COOKIE_NAME: str(),
  SESSION_SECRET: str(),
  COOKIE_DOMAIN: cookieDomain({ default: undefined }), // optional
  COOKIE_SECURE: bool({ default: false }),
  COOKIE_SAMESITE: sameSite({ default: 'lax' }),

  STRIPE_SECRET_KEY: str(),
  STRIPE_PUBLISHABLE_KEY: str(),
  STRIPE_PRICE_BASIC: str(),
  STRIPE_PRICE_PRO: str(),
  STRIPE_PRICE_ULTIMATE: str(),
  STRIPE_PORTAL_RETURN_URL: url({
    default: 'http://localhost:3000/settings/billing'
  }),

  AWS_REGION: str(),
  AWS_S3_BUCKET: str(),
  AWS_S3_BASE_PREFIX: str({ default: 'streakling' }),
  AWS_ACCESS_KEY_ID: str({ default: '' }),
  AWS_SECRET_ACCESS_KEY: str({ default: '' })
});

const AWS_S3_BASE_PREFIX = e.AWS_S3_BASE_PREFIX.replace(/\/+$/, '');

export const env = {
  NODE_ENV: e.NODE_ENV,
  PORT: e.PORT,

  CORS_ORIGIN: e.CORS_ORIGIN,

  DATABASE_URL: e.DATABASE_URL,

  CLERK_PUBLISHABLE_KEY: e.CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: e.CLERK_SECRET_KEY,

  SESSION_COOKIE_NAME: e.SESSION_COOKIE_NAME,
  SESSION_SECRET: e.SESSION_SECRET,
  COOKIE_DOMAIN: e.COOKIE_DOMAIN, // undefined when not set
  COOKIE_SECURE: e.COOKIE_SECURE,
  COOKIE_SAMESITE: e.COOKIE_SAMESITE, // 'lax' | 'strict' | 'none'

  STRIPE_SECRET_KEY: e.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: e.STRIPE_PUBLISHABLE_KEY,
  STRIPE_PRICE_BASIC: e.STRIPE_PRICE_BASIC,
  STRIPE_PRICE_PRO: e.STRIPE_PRICE_PRO,
  STRIPE_PRICE_ULTIMATE: e.STRIPE_PRICE_ULTIMATE,
  STRIPE_PORTAL_RETURN_URL: e.STRIPE_PORTAL_RETURN_URL,

  AWS_REGION: e.AWS_REGION,
  AWS_S3_BUCKET: e.AWS_S3_BUCKET,
  AWS_S3_BASE_PREFIX,
  AWS_ACCESS_KEY_ID: e.AWS_ACCESS_KEY_ID || undefined,
  AWS_SECRET_ACCESS_KEY: e.AWS_SECRET_ACCESS_KEY || undefined
};
