import jwt from 'jsonwebtoken';
import type { Response, Request } from 'express';
import { env } from '../config/env.js';
import { sessionCookieOptions } from './cookies.js';

export type SessionPayload = {
  uid: string;
  cid: string;
  username?: string | null;
  email?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  religion?: string | null;
  country?: string | null;
  role?: 'ADMIN' | 'USER';
};

const COOKIE_NAME = env.SESSION_COOKIE_NAME;

export function setSessionCookie(
  req: Request,
  res: Response,
  payload: SessionPayload
) {
  const token = jwt.sign(payload, env.SESSION_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h'
  });
  res.cookie(COOKIE_NAME, token, sessionCookieOptions(req.headers.host));
}

export function clearSessionCookie(req: Request, res: Response) {
  const opts = sessionCookieOptions(req.headers.host);
  res.clearCookie(COOKIE_NAME, { ...opts, maxAge: undefined });
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
