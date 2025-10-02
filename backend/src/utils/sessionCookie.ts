import jwt from 'jsonwebtoken';
import type { CookieOptions, Response, Request } from 'express';
import { env } from '../config/env.js';

export type SessionPayload = {
  uid: string; // local user id
  cid: string; // clerk user id
  username?: string | null;
  email?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  phone?: string | null; // sensitive (opt-in)
  religion?: string | null; // sensitive (opt-in)
  country?: string | null;
};

const COOKIE_NAME = env.SESSION_COOKIE_NAME;
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  domain: env.COOKIE_DOMAIN,
  path: '/',
  maxAge: 60 * 60 * 1000 // 1 hour
};

export function setSessionCookie(res: Response, payload: SessionPayload) {
  const token = jwt.sign(payload, env.SESSION_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h'
  });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: undefined });
}

export function readSessionCookie(req: Request): SessionPayload | null {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return null;
  try {
    return jwt.verify(raw, env.SESSION_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}
