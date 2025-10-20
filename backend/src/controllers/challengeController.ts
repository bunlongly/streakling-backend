import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import {
  sendSuccess,
  sendUnauthorized,
  sendNotFound,
  sendError,
  sendConflict
} from '../utils/responseHandler';
import {
  createChallengeSchema,
  updateChallengeSchema,
  submitEntrySchema,
  type CreateChallengeInput,
  type UpdateChallengeInput,
  type SubmitEntryInput
} from '../schemas/challenge';

// ---------------- Utilities ----------------
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unexpected error';
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function ensureUniqueChallengeSlug(base: string): Promise<string> {
  let candidate = base || 'challenge';
  let suffix = 0;
  for (;;) {
    const exists = await prisma.challenge.findUnique({
      where: { slug: candidate }
    });
    if (!exists) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

// ---------------- Serializers ----------------
function serializeChallenge(c: any, opts: { isOwner: boolean }) {
  if (!c) return null;
  const postedOn = c.publishedAt
    ? c.publishedAt.toISOString()
    : c.createdAt.toISOString();

  return {
    id: c.id,
    slug: c.slug,
    ownerId: c.userId,
    title: c.title,
    description: c.description ?? null,
    brandName: c.brandName ?? null,
    brandLogoKey: c.brandLogoKey ?? null,
    postingUrl: c.postingUrl ?? null,
    targetPlatforms: c.targetPlatforms ?? [],
    goalViews: c.goalViews ?? null,
    goalLikes: c.goalLikes ?? null,
    deadline: c.deadline ? c.deadline.toISOString() : null,

    publishStatus: c.publishStatus,
    publishedAt: c.publishedAt ? c.publishedAt.toISOString() : null,
    status: c.status,

    prizes: (c.prizes ?? []).map((p: any) => ({
      id: p.id,
      rank: p.rank,
      label: p.label ?? null,
      amountCents: p.amountCents ?? null,
      notes: p.notes ?? null
    })),

    images: (c.images ?? []).map((img: any) => ({
      id: img.id,
      key: img.key,
      url: img.url,
      sortOrder: img.sortOrder
    })),

    postedOn,
    isOwner: opts.isOwner,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString()
  };
}

function serializeSubmission(s: any) {
  // single cover image (if present)
  const cover =
    Array.isArray(s.challenge?.images) && s.challenge.images.length
      ? s.challenge.images[0]
      : null;

  return {
    id: s.id,
    challengeId: s.challengeId,
    submitterId: s.submitterId ?? null,
    platform: s.platform,
    linkUrl: s.linkUrl ?? null,
    imageKey: s.imageKey ?? null,
    notes: s.notes ?? null,

    // snapshot fields
    submitterName: s.submitterName ?? null,
    submitterPhone: s.submitterPhone ?? null,
    submitterSocials: s.submitterSocials ?? [],

    // added fields for client convenience
    challengeSlug: s.challenge?.slug ?? null,
    challengeTitle: s.challenge?.title ?? null,

    // richer challenge brief (for UI)
    challenge: s.challenge
      ? {
          slug: s.challenge.slug,
          title: s.challenge.title,
          brandName: s.challenge.brandName ?? null,
          postingUrl: s.challenge.postingUrl ?? null,
          status: s.challenge.status ?? null,
          publishStatus: s.challenge.publishStatus ?? null,
          deadline: s.challenge.deadline
            ? s.challenge.deadline.toISOString()
            : null,
          cover: cover
            ? { key: cover.key ?? null, url: cover.url ?? null }
            : null
        }
      : null,

    submissionOrder: s.submissionOrder,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString()
  };
}

// ---------------- Owner CRUD ----------------
export async function createChallenge(req: Request, res: Response) {
  const uid = (req as any).user?.uid;
  if (!uid) return sendUnauthorized(res);

  try {
    const payload = createChallengeSchema.parse(
      req.body
    ) as CreateChallengeInput;

    const baseSlug = payload.slug
      ? slugify(payload.slug)
      : slugify(payload.title || 'challenge');
    const slug = await ensureUniqueChallengeSlug(baseSlug);

    const isPublishing = payload.publishStatus === 'PUBLISHED';
    const images = (payload.images ?? []).slice(0, 6);

    const created = await prisma.challenge.create({
      data: {
        userId: uid,
        slug,
        title: payload.title,
        description: payload.description ?? undefined,
        brandName: payload.brandName ?? undefined,
        brandLogoKey: payload.brandLogoKey ?? undefined,
        postingUrl: payload.postingUrl ?? undefined,
        targetPlatforms: payload.targetPlatforms ?? undefined,
        goalViews: payload.goalViews ?? undefined,
        goalLikes: payload.goalLikes ?? undefined,
        deadline: payload.deadline ? new Date(payload.deadline) : undefined,

        publishStatus: payload.publishStatus ?? 'DRAFT',
        publishedAt: isPublishing ? new Date() : undefined,
        status: payload.status ?? 'OPEN',

        prizes: payload.prizes?.length
          ? {
              create: payload.prizes.map(p => ({
                rank: p.rank,
                label: p.label ?? undefined,
                amountCents: p.amountCents ?? undefined,
                notes: p.notes ?? undefined
              }))
            }
          : undefined,

        images: images.length
          ? {
              create: images.map(i => ({
                key: i.key,
                url: i.url,
                sortOrder: i.sortOrder ?? 0
              }))
            }
          : undefined
      },
      include: {
        prizes: { orderBy: { rank: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } }
      }
    });

    return sendSuccess(
      res,
      serializeChallenge(created, { isOwner: true }),
      'Challenge created'
    );
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

export async function listMyChallenges(req: Request, res: Response) {
  const uid = (req as any).user?.uid;
  if (!uid) return sendUnauthorized(res);

  try {
    const rows = await prisma.challenge.findMany({
      where: { userId: uid },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        prizes: { orderBy: { rank: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } }
      }
    });
    return sendSuccess(
      res,
      rows.map(c => serializeChallenge(c, { isOwner: true }))
    );
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

export async function getMyChallengeById(req: Request, res: Response) {
  const uid = (req as any).user?.uid;
  if (!uid) return sendUnauthorized(res);

  try {
    const { id } = req.params;
    const c = await prisma.challenge.findFirst({
      where: { id, userId: uid },
      include: {
        prizes: { orderBy: { rank: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } }
      }
    });
    if (!c) return sendNotFound(res, 'Challenge not found');
    return sendSuccess(res, serializeChallenge(c, { isOwner: true }));
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

export async function updateChallenge(req: Request, res: Response) {
  const uid = (req as any).user?.uid;
  if (!uid) return sendUnauthorized(res);

  try {
    const { id } = req.params;
    const body = updateChallengeSchema.parse(req.body) as UpdateChallengeInput;

    const existing = await prisma.challenge.findFirst({
      where: { id, userId: uid },
      select: { id: true, slug: true, publishedAt: true }
    });
    if (!existing) return sendNotFound(res, 'Challenge not found');

    let slugUpdate: string | undefined;
    if (body.slug && body.slug !== existing.slug) {
      slugUpdate = await ensureUniqueChallengeSlug(slugify(body.slug));
    }

    let publishedAtUpdate: Date | null | undefined;
    if (body.publishStatus) {
      if (body.publishStatus === 'PUBLISHED' && !existing.publishedAt) {
        publishedAtUpdate = new Date();
      } else if (body.publishStatus !== 'PUBLISHED') {
        publishedAtUpdate = null;
      }
    }

    const images = body.images ? body.images.slice(0, 6) : undefined;

    const updated = await prisma.challenge.update({
      where: { id },
      data: {
        slug: slugUpdate ?? undefined,
        title: body.title ?? undefined,
        description: body.description ?? undefined,
        brandName: body.brandName ?? undefined,
        brandLogoKey: body.brandLogoKey ?? undefined,
        postingUrl: body.postingUrl ?? undefined,
        targetPlatforms: body.targetPlatforms ?? undefined,
        goalViews: body.goalViews ?? undefined,
        goalLikes: body.goalLikes ?? undefined,
        deadline: body.deadline ? new Date(body.deadline) : undefined,

        publishStatus: body.publishStatus ?? undefined,
        publishedAt: publishedAtUpdate,
        status: body.status ?? undefined,

        ...(body.prizes
          ? {
              prizes: {
                deleteMany: { challengeId: id },
                create: body.prizes.map(p => ({
                  rank: p.rank,
                  label: p.label ?? undefined,
                  amountCents: p.amountCents ?? undefined,
                  notes: p.notes ?? undefined
                }))
              }
            }
          : {}),

        ...(images
          ? {
              images: {
                deleteMany: { challengeId: id },
                create: images.map(i => ({
                  key: i.key,
                  url: i.url,
                  sortOrder: i.sortOrder ?? 0
                }))
              }
            }
          : {})
      },
      include: {
        prizes: { orderBy: { rank: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } }
      }
    });

    return sendSuccess(
      res,
      serializeChallenge(updated, { isOwner: true }),
      'Challenge updated'
    );
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

export async function deleteChallenge(req: Request, res: Response) {
  const uid = (req as any).user?.uid;
  if (!uid) return sendUnauthorized(res);

  try {
    const { id } = req.params;
    const existing = await prisma.challenge.findFirst({
      where: { id, userId: uid },
      select: { id: true }
    });
    if (!existing) return sendNotFound(res, 'Challenge not found');

    await prisma.challenge.delete({ where: { id } });
    return sendSuccess(res, { deleted: true });
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

// ---------------- Public ----------------
export async function listPublicChallenges(req: Request, res: Response) {
  try {
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? '24'), 10) || 24, 1),
      60
    );
    const cursor = (req.query.cursor as string | undefined) || undefined;
    const q = (req.query.q as string | undefined)?.trim();

    const where: any = { publishStatus: 'PUBLISHED' };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { brandName: { contains: q, mode: 'insensitive' } }
      ];
    }

    const rows = await prisma.challenge.findMany({
      where,
      orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        prizes: { orderBy: { rank: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } }
      }
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return sendSuccess(res, {
      items: items.map(c => serializeChallenge(c, { isOwner: false })),
      nextCursor
    });
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

export async function getPublicChallengeBySlug(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const c = await prisma.challenge.findFirst({
      where: { slug, publishStatus: 'PUBLISHED' },
      include: {
        prizes: { orderBy: { rank: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } }
      }
    });
    if (!c) return sendNotFound(res, 'Challenge not found');
    const isOwner = (req as any).user?.uid === c.userId;
    return sendSuccess(res, serializeChallenge(c, { isOwner }), 'Challenge');
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

// ---------------- Submissions ----------------
export async function createSubmission(req: Request, res: Response) {
  const uid = (req as any).user?.uid;
  if (!uid) return sendUnauthorized(res);

  try {
    const { id } = req.params;
    const input = submitEntrySchema.parse(req.body) as SubmitEntryInput;

    const c = await prisma.challenge.findUnique({ where: { id } });
    if (!c || c.publishStatus !== 'PUBLISHED' || c.status !== 'OPEN') {
      return sendNotFound(res, 'Challenge is not open');
    }

    const found = await prisma.challengeSubmission.findFirst({
      where: { challengeId: id, submitterId: uid }
    });
    if (found)
      return sendConflict(res, 'You have already submitted to this challenge.');

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { displayName: true, phone: true }
    });

    const card = await prisma.digitalNameCard.findFirst({
      where: { userId: uid, publishStatus: 'PUBLISHED' },
      orderBy: [{ publishedAt: 'desc' }],
      select: { id: true }
    });

    let socials:
      | Array<{
          platform: string;
          handle?: string | null;
          url?: string | null;
          label?: string | null;
        }>
      | [] = [];
    if (card?.id) {
      const rows = await prisma.socialAccount.findMany({
        where: { cardId: card.id, isPublic: true },
        orderBy: { sortOrder: 'asc' },
        select: { platform: true, handle: true, url: true, label: true }
      });
      socials = rows.map(r => ({
        platform: r.platform,
        handle: r.handle ?? null,
        url: r.url ?? null,
        label: r.label ?? null
      }));
    }

    const created = await prisma.$transaction(async tx => {
      const updatedCounter = await tx.challenge.update({
        where: { id },
        data: { nextSubmissionOrder: { increment: 1 } },
        select: { nextSubmissionOrder: true }
      });
      const order = updatedCounter.nextSubmissionOrder - 1;

      return tx.challengeSubmission.create({
        data: {
          challengeId: id,
          submitterId: uid,
          platform: input.platform,
          linkUrl: input.linkUrl ?? null,
          imageKey: input.imageKey ?? null,
          notes: input.notes?.length ? input.notes : null,
          submissionOrder: order,
          submitterName: user?.displayName ?? null,
          submitterPhone: user?.phone ?? null,
          submitterSocials: socials.length ? socials : []
        }
      });
    });

    return sendSuccess(res, serializeSubmission(created), 'Submission created');
  } catch (e: unknown) {
    const msg = errMsg(e);
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return sendConflict(res, 'Please retry your submission.');
    }
    return sendError(res, msg);
  }
}

/**
 * DELETE /challenges/:id/submissions
 */
export async function withdrawMySubmission(req: Request, res: Response) {
  const uid = (req as any).user?.uid;
  if (!uid) return sendUnauthorized(res);

  try {
    const { id } = req.params;
    const existing = await prisma.challengeSubmission.findFirst({
      where: { challengeId: id, submitterId: uid },
      select: { id: true }
    });
    if (!existing) return sendNotFound(res, 'No submission to withdraw.');

    await prisma.challengeSubmission.delete({ where: { id: existing.id } });
    return sendSuccess(res, { deleted: true }, 'Submission withdrawn');
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

/**
 * GET /challenges/:id/submissions
 * - Public ordered list by default
 * - If ?mine=1, returns ONLY the current user's submission
 */
export async function listSubmissions(req: Request, res: Response) {
  const mineFlag =
    req.query.mine === '1' ||
    req.query.mine === 'true' ||
    (req.query.mine as any) === 1 ||
    (req.query.mine as any) === true;

  if (mineFlag) {
    const uid = (req as any).user?.uid;
    if (!uid) return sendUnauthorized(res);

    const { id } = req.params;

    const s = await prisma.challengeSubmission.findFirst({
      where: { challengeId: id, submitterId: uid }
    });

    return sendSuccess(res, s ? serializeSubmission(s) : null);
  }

  try {
    const { id } = req.params;
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1),
      100
    );
    const cursor = (req.query.cursor as string | undefined) || undefined;

    const rows = await prisma.challengeSubmission.findMany({
      where: { challengeId: id },
      orderBy: [{ submissionOrder: 'asc' }, { createdAt: 'asc' }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return sendSuccess(res, {
      items: items.map(serializeSubmission),
      nextCursor
    });
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

/**
 * GET /submissions
 * List current user's submissions across challenges (with challenge brief)
 */
export async function listMySubmissions(req: Request, res: Response) {
  const uid = (req as any).user?.uid;
  if (!uid) return sendUnauthorized(res);

  try {
    const rows = await prisma.challengeSubmission.findMany({
      where: { submitterId: uid },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        challenge: {
          select: {
            id: true,
            slug: true,
            title: true,
            brandName: true,
            postingUrl: true,
            status: true,
            publishStatus: true,
            deadline: true,
            // first image only for compact card
            images: {
              orderBy: { sortOrder: 'asc' },
              take: 1,
              select: { key: true, url: true }
            }
          }
        }
      }
    });

    return sendSuccess(res, rows.map(serializeSubmission));
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}

/** PATCH /challenges/:challengeId/submissions/:submissionId/status */
export async function updateSubmissionStatus(req: Request, res: Response) {
  const uid = (req as any).user?.uid;
  if (!uid) return sendUnauthorized(res);

  try {
    const { challengeId, submissionId } = req.params;
    const { status } = (req.body ?? {}) as {
      status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WINNER';
    };
    if (!status) return sendConflict(res, 'Missing status');

    const c = await prisma.challenge.findFirst({
      where: { id: challengeId, userId: uid },
      select: { id: true }
    });
    if (!c) return sendNotFound(res, 'Challenge not found');

    const updated = await prisma.challengeSubmission.update({
      where: { id: submissionId },
      data: { status }
    });
    return sendSuccess(res, serializeSubmission(updated), 'Submission updated');
  } catch (e: unknown) {
    return sendError(res, errMsg(e));
  }
}
