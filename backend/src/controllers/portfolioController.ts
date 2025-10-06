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
  subImages: true,
  videoLinks: true,
  projects: { include: { subImages: true, videoLinks: true } }
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

// POST /portfolios
export async function createPortfolio(req: Request, res: Response) {
  try {
    const userId = req.user?.uid;
    if (!userId) return sendUnauthorized(res);

    if ((req as any).files?.length) {
      return sendConflict(
        res,
        'Raw uploads are not allowed here. Use the upload signer and send keys/urls.'
      );
    }

    const data = createPortfolioSchema.parse(req.body);

    // slug
    const providedSlug = data.slug?.trim();
    const baseSlug = providedSlug || slugify(data.title || 'portfolio');
    const slug = await ensureUniqueSlug(baseSlug);

    // publish
    const isPublishing = data.publishStatus === 'PUBLISHED';

    const created = await prisma.portfolio.create({
      data: {
        userId,
        slug,
        title: data.title,
        description: data.description,
        mainImageKey: data.mainImageKey,
        tags: data.tags ?? [],
        publishStatus: data.publishStatus ?? 'DRAFT',
        publishedAt: isPublishing ? new Date() : undefined,

        subImages: data.subImages
          ? {
              create: data.subImages.map(i => ({
                key: i.key,
                url: i.url,
                sortOrder: i.sortOrder ?? 0
              }))
            }
          : undefined,

        videoLinks: data.videoLinks
          ? {
              create: data.videoLinks.map(v => ({
                platform: v.platform as any,
                url: v.url,
                description: v.description ?? undefined
              }))
            }
          : undefined,

        projects: data.projects
          ? {
              create: data.projects.map(pr => ({
                title: pr.title,
                description: pr.description ?? undefined,
                mainImageKey: pr.mainImageKey ?? undefined,
                tags: pr.tags ?? [],
                subImages: pr.subImages
                  ? {
                      create: pr.subImages.map(i => ({
                        key: i.key,
                        url: i.url,
                        sortOrder: i.sortOrder ?? 0
                      }))
                    }
                  : undefined,
                videoLinks: pr.videoLinks
                  ? {
                      create: pr.videoLinks.map(v => ({
                        platform: v.platform as any,
                        url: v.url,
                        description: v.description ?? undefined
                      }))
                    }
                  : undefined
              }))
            }
          : undefined
      },
      include: fullInclude
    });

    return sendSuccess(res, serializePortfolio(created));
  } catch (err) {
    return sendError(res, err);
  }
}

// GET /portfolios (mine)
export async function listPortfoliosMine(req: Request, res: Response) {
  try {
    const userId = req.user?.uid;
    if (!userId) return sendUnauthorized(res);

    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: fullInclude
    });

    return sendSuccess(res, portfolios.map(serializePortfolio));
  } catch (err) {
    return sendError(res, err);
  }
}

// GET /portfolios/:id (mine)
export async function getMyPortfolioById(req: Request, res: Response) {
  try {
    const userId = req.user?.uid;
    if (!userId) return sendUnauthorized(res);

    const { id } = req.params;
    const p = await prisma.portfolio.findFirst({
      where: { id, userId },
      include: fullInclude
    });

    if (!p) return sendNotFound(res, 'Portfolio not found');
    return sendSuccess(res, serializePortfolio(p));
  } catch (err) {
    return sendError(res, err);
  }
}

// PATCH /portfolios/:id
export async function updatePortfolio(req: Request, res: Response) {
  try {
    const userId = req.user?.uid;
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

    // if slug changed, ensure unique
    let slugUpdate: string | undefined;
    if (body.slug && body.slug !== existing.slug) {
      slugUpdate = await ensureUniqueSlug(body.slug);
    }

    // publish timestamp transitions
    let publishedAtUpdate: Date | null | undefined = undefined;
    if (body.publishStatus) {
      if (body.publishStatus === 'PUBLISHED' && !existing.publishedAt) {
        publishedAtUpdate = new Date();
      } else if (body.publishStatus !== 'PUBLISHED') {
        publishedAtUpdate = null; // clear if moving back to draft/private
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

        ...(body.subImages
          ? {
              subImages: {
                deleteMany: {},
                create: body.subImages.map(i => ({
                  key: i.key,
                  url: i.url,
                  sortOrder: i.sortOrder ?? 0
                }))
              }
            }
          : {}),

        ...(body.videoLinks
          ? {
              videoLinks: {
                deleteMany: {},
                create: body.videoLinks.map(v => ({
                  platform: v.platform as any,
                  url: v.url,
                  description: v.description ?? undefined
                }))
              }
            }
          : {}),

        ...(body.projects
          ? {
              projects: {
                deleteMany: {},
                create: body.projects.map(pr => ({
                  title: pr.title,
                  description: pr.description ?? undefined,
                  mainImageKey: pr.mainImageKey ?? undefined,
                  tags: pr.tags ?? [],
                  subImages: pr.subImages
                    ? {
                        create: pr.subImages.map(i => ({
                          key: i.key,
                          url: i.url,
                          sortOrder: i.sortOrder ?? 0
                        }))
                      }
                    : undefined,
                  videoLinks: pr.videoLinks
                    ? {
                        create: pr.videoLinks.map(v => ({
                          platform: v.platform as any,
                          url: v.url,
                          description: v.description ?? undefined
                        }))
                      }
                    : undefined
                }))
              }
            }
          : {})
      },
      include: fullInclude
    });

    return sendSuccess(res, serializePortfolio(updated));
  } catch (err) {
    return sendError(res, err);
  }
}

// ---- PUBLIC: GET /portfolios/slug/:slug ----
export async function getPublicPortfolioBySlug(req: Request, res: Response) {
  try {
    const { slug } = req.params;

    const p = await prisma.portfolio.findFirst({
      where: {
        slug,
        publishStatus: 'PUBLISHED'
      },
      include: fullInclude
    });

    if (!p) return sendNotFound(res, 'Portfolio not found');
    return sendSuccess(res, serializePortfolio(p));
  } catch (err) {
    return sendError(res, err);
  }
}
