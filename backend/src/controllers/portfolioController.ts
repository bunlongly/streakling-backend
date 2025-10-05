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

// ---- Ensure req.user is typed (you already have this project-wide) ----
// declare module 'express-serve-static-core' { interface Request { user?: SessionPayload | null; } }

function serializePortfolio(p: any) {
  if (!p) return null;
  return {
    ...p,
    subImages: (p.subImages ?? []).sort(
      (a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    )
  };
}

// POST /portfolios
export async function createPortfolio(req: Request, res: Response) {
  try {
    const userId = req.user?.uid; // ✅ same as your sessionCookie payload
    if (!userId) return sendUnauthorized(res);

    // No raw video uploads here (links only)
    if ((req as any).files?.length) {
      return sendConflict(
        res,
        'Raw uploads are not allowed here. Use the upload signer and send keys/urls.'
      );
    }

    const data = createPortfolioSchema.parse(req.body);

    const created = await prisma.portfolio.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        mainImageKey: data.mainImageKey,
        tags: data.tags ?? [],
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
                description: v.description ?? undefined,
                thumbnailUrl: v.thumbnailUrl ?? undefined
              }))
            }
          : undefined
      },
      include: { subImages: true, videoLinks: true }
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
      include: { subImages: true, videoLinks: true }
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
      include: { subImages: true, videoLinks: true }
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

    const updated = await prisma.portfolio.update({
      where: { id },
      data: {
        title: body.title ?? undefined,
        description: body.description ?? undefined,
        mainImageKey: body.mainImageKey ?? undefined,
        tags: body.tags ?? undefined,
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
                  description: v.description ?? undefined,
                  thumbnailUrl: v.thumbnailUrl ?? undefined
                }))
              }
            }
          : {})
      },
      include: { subImages: true, videoLinks: true }
    });

    return sendSuccess(res, serializePortfolio(updated));
  } catch (err) {
    return sendError(res, err);
  }
}

// DELETE /portfolios/:id
export async function deletePortfolio(req: Request, res: Response) {
  try {
    const userId = req.user?.uid;
    if (!userId) return sendUnauthorized(res);

    const { id } = req.params;
    const existing = await prisma.portfolio.findFirst({
      where: { id, userId }
    });
    if (!existing) return sendNotFound(res, 'Portfolio not found');

    await prisma.portfolio.delete({ where: { id } });
    return sendSuccess(res, { deleted: true });
  } catch (err) {
    return sendError(res, err);
  }
}
