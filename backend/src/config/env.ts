import 'dotenv/config';

export const env = {
  PORT: parseInt(process.env.PORT ?? '4000', 10),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:3000',

  DATABASE_URL: process.env.DATABASE_URL ?? '',

  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? '',

  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME ?? 'streakling_session',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'dev_session_secret',

  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? 'localhost',
  COOKIE_SECURE: (process.env.COOKIE_SECURE ?? 'false') === 'true',
  COOKIE_SAMESITE: (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') ?? 'lax'
};
