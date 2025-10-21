import type { CookieOptions } from 'express';
import { env } from '../config/env.js';

/**
 * Build safe cookie options. Only sets 'domain' if it matches the current host.
 * Never use 'localhost' as a domain; leave it undefined (host-only).
 */
export function sessionCookieOptions(hostHeader?: string): CookieOptions {
  const host = (hostHeader ?? '').split(':')[0]; // strip port if present
  const cfgDomain = env.COOKIE_DOMAIN;            // may be undefined

  const canUseDomain =
    !!cfgDomain && (host === cfgDomain || host.endsWith(`.${cfgDomain}`));

  const opts: CookieOptions = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,                 // true in prod
    sameSite: env.COOKIE_SAMESITE,             // 'none' in prod (cross-site)
    path: '/',
    maxAge: 60 * 60 * 1000,                    // 1 hour
  };

  if (canUseDomain) {
    opts.domain = cfgDomain;                   // only when valid for this host
  }
  return opts;
}
