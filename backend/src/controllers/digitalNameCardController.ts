import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import {
  sendSuccess,
  sendUnauthorized,
  sendConflict,
  sendNotFound,
  sendError
} from '../utils/reponseHandller';
import type {
  CreateDigitalCardInput,
  UpdateDigitalCardInput
} from '../schemas/digitalNameCard';

function serializeCard(card: any, opts: { isOwner: boolean }) {
  if (!card) return null;

  const {
    phone,
    religion,
    company,
    university,
    country,
    showPhone,
    showReligion,
    showCompany,
    showUniversity,
    showCountry,
    ...rest
  } = card;

  const out: any = {
    ...rest,
    // expose flags so the client knows what will be visible
    showPhone,
    showReligion,
    showCompany,
    showUniversity,
    showCountry
  };

  if (opts.isOwner) {
    // owners see everything
    out.phone = phone ?? null;
    out.religion = religion ?? null;
    out.company = company ?? null;
    out.university = university ?? null;
    out.country = country ?? null;
  } else {
    // public view respects flags
    out.phone = showPhone ? phone ?? null : null;
    out.religion = showReligion ? religion ?? null : null;
    out.company = showCompany ? company ?? null : null;
    out.university = showUniversity ? university ?? null : null;
    out.country = showCountry ? country ?? null : null;
  }

  return out;
}

/** POST /api/digital-name-cards — create (many per user) */
export async function createCard(req: Request, res: Response) {
  if (!req.user?.uid) return sendUnauthorized(res);
  const input = req.body as CreateDigitalCardInput;

  try {
    // global vanity slug uniqueness
    const exists = await prisma.digitalNameCard.findUnique({
      where: { slug: input.slug },
      select: { id: true }
    });
    if (exists) return sendConflict(res, 'Slug already exists');

    const created = await prisma.digitalNameCard.create({
      data: {
        userId: req.user.uid,
        ...input,
        publishedAt: input.publishStatus === 'PUBLISHED' ? new Date() : null
      }
    });

    return sendSuccess(
      res,
      serializeCard(created, { isOwner: true }),
      'Card created'
    );
  } catch (e: any) {
    return sendError(res, e?.message ?? 'Failed to create card');
  }
}

/** GET /api/me/digital-name-cards — owner list (all) */
export async function listMyCards(req: Request, res: Response) {
  if (!req.user?.uid) return sendUnauthorized(res);
  try {
    const cards = await prisma.digitalNameCard.findMany({
      where: { userId: req.user.uid },
      orderBy: [{ publishStatus: 'desc' }, { updatedAt: 'desc' }]
    });
    return sendSuccess(
      res,
      cards.map(c => serializeCard(c, { isOwner: true })),
      'My cards'
    );
  } catch (e: any) {
    return sendError(res, e?.message ?? 'Failed to list cards');
  }
}

/** PATCH /api/digital-name-cards/:id — owner update */
export async function updateCard(req: Request, res: Response) {
  if (!req.user?.uid) return sendUnauthorized(res);
  const { id } = req.params;
  const input = req.body as UpdateDigitalCardInput;

  try {
    const card = await prisma.digitalNameCard.findUnique({ where: { id } });
    if (!card || card.userId !== req.user.uid)
      return sendNotFound(res, 'Card not found');

    // if slug is changing, ensure global uniqueness
    if (input.slug && input.slug !== card.slug) {
      const exists = await prisma.digitalNameCard.findUnique({
        where: { slug: input.slug },
        select: { id: true }
      });
      if (exists) return sendConflict(res, 'Slug already exists');
    }

    const updated = await prisma.digitalNameCard.update({
      where: { id },
      data: {
        ...input,
        publishedAt:
          input.publishStatus === 'PUBLISHED' && !card.publishedAt
            ? new Date()
            : input.publishStatus === 'DRAFT'
            ? null
            : card.publishedAt
      }
    });

    return sendSuccess(
      res,
      serializeCard(updated, { isOwner: true }),
      'Card updated'
    );
  } catch (e: any) {
    return sendError(res, e?.message ?? 'Failed to update card');
  }
}

/** GET /api/digital-name-card/slug/:slug — public (published only) */
export async function getPublicCardBySlug(req: Request, res: Response) {
  const { slug } = req.params;
  try {
    const card = await prisma.digitalNameCard.findUnique({ where: { slug } });
    if (!card || card.publishStatus !== 'PUBLISHED') {
      return sendNotFound(res, 'Card not found');
    }
    const isOwner = req.user?.uid === card.userId; // if session cookie present for owner
    return sendSuccess(res, serializeCard(card, { isOwner }), 'Card');
  } catch (e: any) {
    return sendError(res, e?.message ?? 'Failed to fetch card');
  }
}
