import { Router } from 'express';
import {
  sendBadRequest,
  sendSuccess,
  sendUnauthorized
} from '../utils/reponseHandller';
import {
  setSessionCookie,
  clearSessionCookie
} from '../utils/sessionCookie.js';
import { upsertUserFromClerk } from '../services/userService.js';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { env } from '../config/env.js';

const router = Router();
const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

/**
 * POST /api/session/login
 * Body: { token: "<Clerk JWT>", sensitive?: { phone?, religion?, country? } }
 */
router.post('/session/login', async (req, res) => {
  const token = req.body?.token as string | undefined;
  if (!token) return sendBadRequest(res, 'Missing token');

  try {
    const verified = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY
    });

    const clerkUserId = verified.sub;
    if (!clerkUserId) return sendUnauthorized(res, 'Invalid token');

    // Load full Clerk user
    const cu = await clerk.users.getUser(clerkUserId);

    const primaryEmail =
      cu.emailAddresses?.find(e => e.id === cu.primaryEmailAddressId)
        ?.emailAddress ??
      cu.emailAddresses?.[0]?.emailAddress ??
      null;

    const username = cu.username ?? null;
    const displayName =
      cu.firstName || cu.lastName
        ? `${cu.firstName ?? ''} ${cu.lastName ?? ''}`.trim()
        : cu.fullName || 'User';
    const avatarUrl = cu.imageUrl ?? null;

    // IMPORTANT: don't default to null — use undefined when missing so we don't overwrite.
    const sensitive = (req.body?.sensitive ?? {}) as {
      phone?: string | null;
      religion?: string | null;
      country?: string | null;
    };

    const user = await upsertUserFromClerk({
      clerkId: clerkUserId,
      username: username ?? undefined,
      email: primaryEmail ?? undefined,
      displayName,
      avatarUrl: avatarUrl ?? undefined,
      country: sensitive.country ?? undefined,
      phone: sensitive.phone ?? undefined,
      religion: sensitive.religion ?? undefined
    });

    // Set signed, httpOnly cookie
    setSessionCookie(res, {
      uid: user.id,
      cid: user.clerkId,
      username: user.username ?? null,
      email: user.email ?? null,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      phone: user.phone ?? null,
      religion: user.religion ?? null,
      country: user.country ?? null
    });

    return sendSuccess(res, { userId: user.id }, 'Logged in');
  } catch (err: any) {
    return sendUnauthorized(res, err?.message ?? 'Invalid or expired token');
  }
});

/** POST /api/session/logout */
router.post('/session/logout', async (_req, res) => {
  clearSessionCookie(res);
  return sendSuccess(res, null, 'Logged out');
});

export default router;
