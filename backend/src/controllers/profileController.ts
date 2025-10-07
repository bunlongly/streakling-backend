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

function serializeProfile(u: any, opts: { isOwner: boolean }) {
  if (!u) return null;

  const flags = {
    showEmail: !!u.showEmail,
    showReligion: !!u.showReligion,
    showDateOfBirth: !!u.showDateOfBirth,
    showPhone: !!u.showPhone,
    showCountry: !!u.showCountry
  };

  const base: any = {
    id: u.id,
    username: u.username ?? null,
    displayName: u.displayName,
    avatarKey: u.avatarKey ?? null,
    avatarUrl: u.avatarUrl ?? null,
    bannerKey: u.bannerKey ?? null,
    industries:
      (u.industries || []).map((ui: any) => ({
        slug: ui.industry.slug,
        name: ui.industry.name
      })) ?? [],
    ...flags,
    isOwner: opts.isOwner
  };

  if (opts.isOwner) {
    base.email = u.email ?? null;
    base.country = u.country ?? null;
    base.religion = u.religion ?? null;
    base.dateOfBirth = u.dateOfBirth ? u.dateOfBirth.toISOString() : null;
    base.phone = u.phone ?? null;
  } else {
    base.email = flags.showEmail ? u.email ?? null : null;
    base.country = flags.showCountry ? u.country ?? null : null;
    base.religion = flags.showReligion ? u.religion ?? null : null;
    base.dateOfBirth = flags.showDateOfBirth
      ? u.dateOfBirth
        ? u.dateOfBirth.toISOString()
        : null
      : null;
    base.phone = flags.showPhone ? u.phone ?? null : null;
  }

  return base;
}

function toDateOrNull(s?: string) {
  if (!s) return undefined;
  const d = new Date(`${s}T00:00:00.000Z`);
  return isNaN(+d) ? undefined : d;
}

/** GET /api/profile — requires session, returns own profile */
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
  } catch (e) {
    return sendError(res, e);
  }
}

/** PATCH /api/profile — requires session, updates own profile */
export async function updateProfile(req: Request, res: Response) {
  if (!req.user?.uid) return sendUnauthorized(res);
  try {
    const input = updateMyProfileSchema.parse(req.body);

    if (input.username) {
      const existing = await prisma.user.findFirst({
        where: { username: input.username, NOT: { id: req.user.uid } },
        select: { id: true }
      });
      if (existing) return sendConflict(res, 'Username is already taken');
    }

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
            .replace(/\b\w/g, c => c.toUpperCase());
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

    const data: any = {
      username: input.username ?? undefined,
      displayName: input.displayName ?? undefined,
      email: input.email ?? undefined,
      country: input.country ?? undefined,
      religion: input.religion ?? undefined,
      dateOfBirth: input.dateOfBirth
        ? toDateOrNull(input.dateOfBirth)
        : undefined,
      phone: input.phone ?? undefined,

      showEmail: input.showEmail ?? undefined,
      showReligion: input.showReligion ?? undefined,
      showDateOfBirth: input.showDateOfBirth ?? undefined,
      showPhone: input.showPhone ?? undefined,
      showCountry: input.showCountry ?? undefined,

      ...(industriesData ? { industries: industriesData } : {})
    };

    if ('avatarKey' in input) data.avatarKey = input.avatarKey;
    if ('bannerKey' in input) data.bannerKey = input.bannerKey;

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
  } catch (e) {
    return sendError(res, e);
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
  } catch (e) {
    return sendError(res, e);
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
  } catch (e) {
    return sendError(res, e);
  }
}

/** PUBLIC: GET /api/profiles/public — list public profiles (paginated) */
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
  } catch (e) {
    return sendError(res, e);
  }
}
