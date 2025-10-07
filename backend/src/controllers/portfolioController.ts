// src/controllers/portfolioController.ts
import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendUnauthorized,
  sendConflict
} from '../utils/reponseHandller';
import {
  createPortfolioSchema,
  updatePortfolioSchema
} from '../schemas/portfolio';

// --- helper to stringify unknown errors safely ---
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unexpected error';
  }
}

type WithSortOrder = { sortOrder?: number };
function sortByOrder<T extends WithSortOrder>(a: T, b: T) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
}
function serializeProject(proj: unknown) {
  const p = proj as any;
  if (!p) return null;
  return { ...p, subImages: (p.subImages ?? []).slice().sort(sortByOrder) };
}
function serializePortfolio(p: unknown) {
  const x = p as any;
  if (!x) return null;
  return {
    ...x,
    subImages: (x.subImages ?? []).slice().sort(sortByOrder),
    projects: (x.projects ?? []).map(serializeProject)
  };
}

const fullInclude = {
  subImages: { orderBy: { sortOrder: 'asc' } },
  videoLinks: true,
  projects: {
    include: { subImages: { orderBy: { sortOrder: 'asc' } }, videoLinks: true }
  },
  experiences: { orderBy: { startDate: 'desc' } },
  educations: { orderBy: { startDate: 'desc' } }
} as const;

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
async function ensureUniqueSlug(base: string): Promise<string> {
  let candidate = base || 'portfolio';
  let suffix = 0;
  for (;;) {
    const exists = await prisma.portfolio.findUnique({
      where: { slug: candidate }
    });
    if (!exists) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

function toDateOrNull(v?: unknown): Date | null | undefined {
  if (v == null || v === '') return undefined;
  if (v instanceof Date) return isNaN(+v) ? undefined : v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return undefined;
    const iso = /T\d{2}:\d{2}/.test(s) ? s : `${s}T00:00:00.000Z`;
    const d = new Date(iso);
    return isNaN(+d) ? undefined : d;
  }
  return undefined;
}

// nested builders
const createSubImages = (
  arr?: Array<{ key: string; url: string; sortOrder?: number }>
) =>
  arr && arr.length
    ? {
        create: arr.map(i => ({
          key: i.key,
          url: i.url,
          sortOrder: i.sortOrder ?? 0
        }))
      }
    : undefined;

const createVideoLinks = (
  arr?: Array<{ platform: string; url: string; description?: string }>
) =>
  arr && arr.length
    ? {
        create: arr.map(v => ({
          platform: v.platform as any,
          url: v.url,
          description: v.description ?? undefined
        }))
      }
    : undefined;

const createProjects = (arr?: any[]) =>
  arr && arr.length
    ? {
        create: arr.map(pr => ({
          title: pr.title,
          description: pr.description ?? undefined,
          mainImageKey: pr.mainImageKey ?? undefined,
          tags: pr.tags ?? [],
          subImages: createSubImages(pr.subImages),
          videoLinks: createVideoLinks(pr.videoLinks)
        }))
      }
    : undefined;

const createExperiences = (arr?: any[]) =>
  arr && arr.length
    ? {
        create: arr.map(e => ({
          company: e.company,
          role: e.role,
          location: e.location ?? undefined,
          startDate: toDateOrNull(e.startDate),
          endDate: toDateOrNull(e.endDate),
          current: !!e.current,
          summary: e.summary ?? undefined
        }))
      }
    : undefined;

const createEducations = (arr?: any[]) =>
  arr && arr.length
    ? {
        create: arr.map(ed => ({
          school: ed.school,
          degree: ed.degree ?? undefined,
          field: ed.field ?? undefined,
          startDate: toDateOrNull(ed.startDate),
          endDate: toDateOrNull(ed.endDate),
          summary: ed.summary ?? undefined
        }))
      }
    : undefined;

/* ==================== CONTROLLERS ==================== */

// POST /portfolios
export async function createPortfolio(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) return sendUnauthorized(res);
    if ((req as any).files?.length) {
      return sendConflict(
        res,
        'Raw uploads are not allowed here. Use the upload signer and send keys/urls.'
      );
    }

    const data = createPortfolioSchema.parse(req.body);

    const providedSlug = data.slug?.trim();
    const baseSlug = providedSlug || slugify(data.title || 'portfolio');
    const slug = await ensureUniqueSlug(baseSlug);

    // Prefill About from Card (optional) + provenance
    let about = data.about;
    let sourceCardId: string | undefined;
    let sourceCardSnapshot: any | undefined;

    if (data.prefillFromCardId) {
      const card = await prisma.digitalNameCard.findFirst({
        where: { id: data.prefillFromCardId, userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          shortBio: true,
          company: true,
          university: true,
          country: true,
          avatarKey: true,
          bannerKey: true
        }
      });

      if (card) {
        // Only overwrite if about wasn't provided; but provenance is always recorded
        if (!about) {
          about = {
            firstName: card.firstName,
            lastName: card.lastName,
            role: card.role,
            shortBio: card.shortBio ?? undefined,
            company: card.company ?? undefined,
            university: card.university ?? undefined,
            country: card.country ?? undefined,
            avatarKey: card.avatarKey ?? undefined, // 👈 avatar in
            bannerKey: card.bannerKey ?? undefined // 👈 banner in
          };
        }
        sourceCardId = card.id;
        sourceCardSnapshot = {
          firstName: card.firstName,
          lastName: card.lastName,
          role: card.role,
          shortBio: card.shortBio ?? undefined,
          company: card.company ?? undefined,
          university: card.university ?? undefined,
          country: card.country ?? undefined,
          avatarKey: card.avatarKey ?? undefined,
          bannerKey: card.bannerKey ?? undefined
        };
      }
    }

    const isPublishing = data.publishStatus === 'PUBLISHED';

    const created = await prisma.portfolio.create({
      data: {
        userId,
        slug,
        title: data.title,
        description: data.description,
        mainImageKey: data.mainImageKey,
        tags: data.tags ?? [],

        about: about ?? undefined,

        // 👇 persist provenance even if user didn’t edit anything
        sourceCardId,
        sourceCardSnapshot,

        publishStatus: data.publishStatus ?? 'DRAFT',
        publishedAt: isPublishing ? new Date() : undefined,

        subImages: createSubImages(data.subImages),
        videoLinks: createVideoLinks(data.videoLinks),
        projects: createProjects(data.projects),
        experiences: createExperiences(data.experiences),
        educations: createEducations(data.educations)
      },
      include: fullInclude
    });

    return sendSuccess(res, serializePortfolio(created));
  } catch (err: unknown) {
    return sendError(res, errMsg(err));
  }
}

// GET /portfolios (mine)
export async function listPortfoliosMine(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) return sendUnauthorized(res);

    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: fullInclude
    });

    return sendSuccess(res, portfolios.map(serializePortfolio));
  } catch (err: unknown) {
    return sendError(res, errMsg(err));
  }
}

// GET /portfolios/:id (mine)
export async function getMyPortfolioById(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) return sendUnauthorized(res);

    const { id } = req.params;
    const p = await prisma.portfolio.findFirst({
      where: { id, userId },
      include: fullInclude
    });

    if (!p) return sendNotFound(res, 'Portfolio not found');
    return sendSuccess(res, serializePortfolio(p));
  } catch (err: unknown) {
    return sendError(res, errMsg(err));
  }
}

// PATCH /portfolios/:id
export async function updatePortfolio(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) return sendUnauthorized(res);

    const { id } = req.params;
    if (!id) return sendNotFound(res, 'Missing portfolio id');

    if ((req as any).files?.length) {
      return sendConflict(
        res,
        'Raw uploads are not allowed here. Use the upload signer and send keys/urls.'
      );
    }

    const body = updatePortfolioSchema.parse(req.body);

    const existing = await prisma.portfolio.findFirst({
      where: { id, userId }
    });
    if (!existing) return sendNotFound(res, 'Portfolio not found');

    let slugUpdate: string | undefined;
    if (body.slug && body.slug !== existing.slug) {
      slugUpdate = await ensureUniqueSlug(body.slug);
    }

    let publishedAtUpdate: Date | null | undefined = undefined;
    if (body.publishStatus) {
      if (body.publishStatus === 'PUBLISHED' && !existing.publishedAt) {
        publishedAtUpdate = new Date();
      } else if (body.publishStatus !== 'PUBLISHED') {
        publishedAtUpdate = null;
      }
    }

    const updated = await prisma.portfolio.update({
      where: { id },
      data: {
        slug: slugUpdate ?? undefined,
        title: body.title ?? undefined,
        description: body.description ?? undefined,
        mainImageKey: body.mainImageKey ?? undefined,
        tags: body.tags ?? undefined,
        publishStatus: body.publishStatus ?? undefined,
        publishedAt: publishedAtUpdate,
        about: body.about ?? undefined,

        ...(body.subImages
          ? {
              subImages: { deleteMany: {}, ...createSubImages(body.subImages) }
            }
          : {}),
        ...(body.videoLinks
          ? {
              videoLinks: {
                deleteMany: {},
                ...createVideoLinks(body.videoLinks)
              }
            }
          : {}),
        ...(body.projects
          ? { projects: { deleteMany: {}, ...createProjects(body.projects) } }
          : {}),
        ...(body.experiences
          ? {
              experiences: {
                deleteMany: {},
                ...createExperiences(body.experiences)
              }
            }
          : {}),
        ...(body.educations
          ? {
              educations: {
                deleteMany: {},
                ...createEducations(body.educations)
              }
            }
          : {})
      },
      include: fullInclude
    });

    return sendSuccess(res, serializePortfolio(updated));
  } catch (err: unknown) {
    return sendError(res, errMsg(err));
  }
}

// DELETE /portfolios/:id
export async function deletePortfolio(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) return sendUnauthorized(res);

    const { id } = req.params;
    const existing = await prisma.portfolio.findFirst({
      where: { id, userId },
      select: { id: true }
    });
    if (!existing) return sendNotFound(res, 'Portfolio not found');

    await prisma.portfolio.delete({ where: { id } }); // cascades
    return sendSuccess(res, { deleted: true });
  } catch (err: unknown) {
    return sendError(res, errMsg(err));
  }
}

// PUBLIC: GET /portfolios/slug/:slug
export async function getPublicPortfolioBySlug(req: Request, res: Response) {
  try {
    const { slug } = req.params;

    const p = await prisma.portfolio.findFirst({
      where: { slug, publishStatus: 'PUBLISHED' },
      include: fullInclude
    });

    if (!p) return sendNotFound(res, 'Portfolio not found');
    return sendSuccess(res, serializePortfolio(p));
  } catch (err: unknown) {
    return sendError(res, errMsg(err));
  }
}

// GET /portfolios/prefill-from-card/:cardId  (auth)
export async function prefillPortfolioFromCard(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) return sendUnauthorized(res);

    const { cardId } = req.params;
    const card = await prisma.digitalNameCard.findFirst({
      where: { id: cardId, userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        shortBio: true,
        company: true,
        university: true,
        country: true,
        avatarKey: true,
        bannerKey: true
      }
    });

    if (!card) return sendNotFound(res, 'Card not found');

    const payload = {
      title: `${card.firstName} ${card.lastName} — Portfolio`.trim(),
      description: card.shortBio ?? undefined,
      about: {
        firstName: card.firstName,
        lastName: card.lastName,
        role: card.role,
        shortBio: card.shortBio ?? undefined,
        company: card.company ?? undefined,
        university: card.university ?? undefined,
        country: card.country ?? undefined,
        avatarKey: card.avatarKey ?? undefined,
        bannerKey: card.bannerKey ?? undefined
      },
      // 👇 return cardId so the client can post it back on create
      prefillFromCardId: card.id
    };

    return sendSuccess(res, payload);
  } catch (err: unknown) {
    return sendError(res, errMsg(err));
  }
}

// PUBLIC: GET /portfolios/public — list all published portfolios (paginated)
export async function listPublicPortfolios(req: Request, res: Response) {
  try {
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? '24'), 10) || 24, 1),
      60
    );
    const cursor = (req.query.cursor as string | undefined) || undefined;

    const rows = await prisma.portfolio.findMany({
      where: { publishStatus: 'PUBLISHED' },
      orderBy: { id: 'desc' }, // 👈 stable and unique
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: fullInclude
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, -1) : rows;
    const nextCursor = hasMore ? items[items.length - 1]!.id : null;

    return sendSuccess(res, {
      items: items.map(serializePortfolio),
      nextCursor
    });
  } catch (err: unknown) {
    return sendError(res, errMsg(err));
  }
}
