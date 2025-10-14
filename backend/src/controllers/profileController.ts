// src/controllers/profileController.ts
import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import {
  sendSuccess,
  sendUnauthorized,
  sendNotFound,
  sendError,
  sendConflict
} from '../utils/reponseHandller';
import { updateMyProfileSchema } from '../schemas/profile';

/* ==================== Helpers ==================== */

// Safe error → message for sendError()
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unexpected error';
  }
}

/**
 * Format a JS/Prisma Date to a date-only string "YYYY-MM-DD".
 * We use toISOString().slice(0,10) after storing the date as a stable UTC noon
 * (see toDateOrNull) to avoid off-by-one shifts.
 */
function toYMD(d?: Date | null): string | null {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

/**
 * Parse a date-only "YYYY-MM-DD" into a Date that won't drift across TZs.
 * We construct at 12:00 UTC to sidestep edge cases where midnight UTC
 * can render as the prior/next day in some environments.
 *
 * - undefined  => do not update
 * - null       => clear column (set to null)
 * - ''         => do not update (treated like undefined by caller)
 * - 'YYYY-MM-DD' => Date(UTC noon) for that calendar day
 */
function toDateOrNull(s?: string | null): Date | null | undefined {
  if (s === undefined) return undefined; // don't touch
  if (s === null) return null; // explicit clear
  const trimmed = s.trim();
  if (!trimmed) return undefined; // empty string => don't touch
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!m) return undefined;
  const [, yy, mm, dd] = m;
  const y = Number(yy);
  const mo = Number(mm);
  const d = Number(dd);
  if (
    !Number.isInteger(y) ||
    !Number.isInteger(mo) ||
    !Number.isInteger(d) ||
    mo < 1 ||
    mo > 12 ||
    d < 1 ||
    d > 31
  ) {
    return undefined;
  }
  // Stable UTC noon for the calendar date:
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
}

/**
 * Serialize a user record to the public/owner-aware payload.
 * Owner sees owner-only fields; non-owner respects visibility flags.
 * DOB is returned as "YYYY-MM-DD" (or null).
 *
 * 🔑 IMPORTANT: We now include `role` for the owner, so the frontend can show Admin UI.
 */
function serializeProfile(u: any, opts: { isOwner: boolean }) {
  if (!u) return null;

  const flags = {
    showEmail: !!u.showEmail,
    showReligion: !!u.showReligion,
    showDateOfBirth: !!u.showDateOfBirth,
    showPhone: !!u.showPhone,
    showCountry: !!u.showCountry
  };

  const industries =
    (u.industries || []).map((ui: any) => ({
      slug: ui.industry.slug,
      name: ui.industry.name
    })) ?? [];

  const base: any = {
    id: u.id,
    username: u.username ?? null,
    displayName: u.displayName,
    avatarKey: u.avatarKey ?? null,
    avatarUrl: u.avatarUrl ?? null, // if you store external avatar URLs
    bannerKey: u.bannerKey ?? null,
    industries,
    ...flags,
    isOwner: opts.isOwner
  };

  if (opts.isOwner) {
    // 🔑 Expose role to the owner (needed by frontend to render Admin)
    base.role = u.role ?? 'USER';

    base.email = u.email ?? null;
    base.country = u.country ?? null;
    base.religion = u.religion ?? null;
    base.dateOfBirth = toYMD(u.dateOfBirth);
    base.phone = u.phone ?? null;
  } else {
    // Public view — do NOT expose role
    base.email = flags.showEmail ? u.email ?? null : null;
    base.country = flags.showCountry ? u.country ?? null : null;
    base.religion = flags.showReligion ? u.religion ?? null : null;
    base.dateOfBirth = flags.showDateOfBirth ? toYMD(u.dateOfBirth) : null;
    base.phone = flags.showPhone ? u.phone ?? null : null;
  }

  return base;
}

/* ==================== Controllers ==================== */

/** GET /api/profile — requires session, returns own profile (includes role) */
export async function getProfile(req: Request, res: Response) {
  if (!req.user?.uid) return sendUnauthorized(res);
  try {
    const u = await prisma.user.findUnique({
      where: { id: req.user.uid },
      include: { industries: { include: { industry: true } } }
    });
    if (!u) return sendNotFound(res, 'User not found');
    return sendSuccess(
      res,
      serializeProfile(u, { isOwner: true }),
      'My profile'
    );
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

/** PATCH /api/profile — requires session, updates own profile */
export async function updateProfile(req: Request, res: Response) {
  if (!req.user?.uid) return sendUnauthorized(res);
  try {
    // Validate body
    const input = updateMyProfileSchema.parse(req.body);

    // username uniqueness (if changing)
    if (input.username) {
      const existing = await prisma.user.findFirst({
        where: { username: input.username, NOT: { id: req.user.uid } },
        select: { id: true }
      });
      if (existing) return sendConflict(res, 'Username is already taken');
    }

    // industries upsert (replace all if provided)
    let industriesData:
      | {
          deleteMany: Record<string, never>;
          create: Array<{ industryId: string }>;
        }
      | undefined;

    if (Array.isArray(input.industries)) {
      const uniqueSlugs = Array.from(
        new Set(input.industries.map(s => s.toLowerCase()))
      );

      const inds = await Promise.all(
        uniqueSlugs.map(async slug => {
          const name = slug
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
          return prisma.industry.upsert({
            where: { slug },
            update: {},
            create: { slug, name }
          });
        })
      );

      industriesData = {
        deleteMany: {},
        create: inds.map(ind => ({ industryId: ind.id }))
      };
    }

    // Build data map; undefined => don't touch, null => clear (for nullable fields)
    const data: any = {
      username: input.username ?? undefined,
      displayName: input.displayName ?? undefined,
      email: input.email ?? undefined,
      country: input.country ?? undefined,
      religion: input.religion ?? undefined,
      dateOfBirth:
        input.dateOfBirth !== undefined
          ? toDateOrNull(input.dateOfBirth as string | null)
          : undefined,
      phone: input.phone ?? undefined,

      showEmail: input.showEmail ?? undefined,
      showReligion: input.showReligion ?? undefined,
      showDateOfBirth: input.showDateOfBirth ?? undefined,
      showPhone: input.showPhone ?? undefined,
      showCountry: input.showCountry ?? undefined,

      ...(industriesData ? { industries: industriesData } : {})
    };

    // Allow clearing image columns by sending null; updating by sending string
    if ('avatarKey' in input) data.avatarKey = input.avatarKey; // string|null
    if ('bannerKey' in input) data.bannerKey = input.bannerKey; // string|null

    const updated = await prisma.user.update({
      where: { id: req.user.uid },
      data,
      include: { industries: { include: { industry: true } } }
    });

    return sendSuccess(
      res,
      serializeProfile(updated, { isOwner: true }),
      'Profile updated'
    );
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

/** PUBLIC: GET /api/u/:username — public profile by username */
export async function getPublicProfileByUsername(req: Request, res: Response) {
  const { username } = req.params;
  try {
    const u = await prisma.user.findFirst({
      where: { username },
      include: { industries: { include: { industry: true } } }
    });
    if (!u) return sendNotFound(res, 'User not found');
    const isOwner = req.user?.uid === u.id;
    return sendSuccess(res, serializeProfile(u, { isOwner }), 'Profile');
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

/** PUBLIC: GET /api/u/id/:id — public profile by id (fallback when no username) */
export async function getPublicProfileById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const u = await prisma.user.findFirst({
      where: { id },
      include: { industries: { include: { industry: true } } }
    });
    if (!u) return sendNotFound(res, 'User not found');
    const isOwner = req.user?.uid === u.id;
    return sendSuccess(res, serializeProfile(u, { isOwner }), 'Profile');
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

/** PUBLIC: GET /api/profiles/public — list public profiles (paginated, optional search) */
export async function listPublicProfiles(req: Request, res: Response) {
  try {
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? '24'), 10) || 24, 1),
      60
    );
    const cursor = (req.query.cursor as string | undefined) || undefined;
    const q = (req.query.q as string | undefined)?.trim();

    const where: any = {};
    if (q) {
      where.OR = [
        { username: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
        { country: { contains: q, mode: 'insensitive' } }
      ];
    }

    const rows = await prisma.user.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: { industries: { include: { industry: true } } }
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    const payload = items.map(u => serializeProfile(u, { isOwner: false }));

    return sendSuccess(res, { items: payload, nextCursor }, 'Public profiles');
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}
