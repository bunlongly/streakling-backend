// controllers/digitalNameCardController.ts
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

/** --- Helpers --- */
function serializeSocial(s: any) {
  return {
    id: s.id,
    platform: s.platform,
    handle: s.handle ?? null,
    url: s.url ?? null,
    label: s.label ?? null,
    isPublic: !!s.isPublic,
    sortOrder: typeof s.sortOrder === 'number' ? s.sortOrder : 0
  };
}

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
    socials = [],
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
    out.socials = (socials || [])
      .map(serializeSocial)
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  } else {
    // public view respects flags + social visibility
    out.phone = showPhone ? phone ?? null : null;
    out.religion = showReligion ? religion ?? null : null;
    out.company = showCompany ? company ?? null : null;
    out.university = showUniversity ? university ?? null : null;
    out.country = showCountry ? country ?? null : null;
    out.socials = (socials || [])
      .filter((s: any) => s.isPublic)
      .map(serializeSocial)
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
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

    const { socials = [], ...cardData } = input;

    const created = await prisma.digitalNameCard.create({
      data: {
        userId: req.user.uid,
        ...cardData,
        publishedAt: input.publishStatus === 'PUBLISHED' ? new Date() : null,
        socials: {
          create: (socials || []).map(s => ({
            platform: s.platform,
            handle: s.handle,
            url: s.url,
            label: s.label,
            isPublic: typeof s.isPublic === 'boolean' ? s.isPublic : true,
            sortOrder: typeof s.sortOrder === 'number' ? s.sortOrder : 0
          }))
        }
      },
      include: { socials: true }
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
      orderBy: [{ publishStatus: 'desc' }, { updatedAt: 'desc' }],
      include: { socials: true }
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

/** GET /api/digital-name-cards/:id — owner fetch single (for edit form) */
export async function getMyCardById(req: Request, res: Response) {
  if (!req.user?.uid) return sendUnauthorized(res);
  const { id } = req.params;

  try {
    const card = await prisma.digitalNameCard.findUnique({
      where: { id },
      include: { socials: true }
    });
    if (!card || card.userId !== req.user.uid) {
      return sendNotFound(res, 'Card not found');
    }

    return sendSuccess(res, serializeCard(card, { isOwner: true }), 'My card');
  } catch (e: any) {
    return sendError(res, e?.message ?? 'Failed to fetch card');
  }
}

/** PATCH /api/digital-name-cards/:id — owner update (controller-only ownership) */
export async function updateCard(req: Request, res: Response) {
  if (!req.user?.uid) return sendUnauthorized(res);
  const { id } = req.params;
  const input = req.body as UpdateDigitalCardInput;

  try {
    const updated = await prisma.$transaction(async tx => {
      // 1) load + own check
      const card = await tx.digitalNameCard.findUnique({
        where: { id },
        include: { socials: true }
      });
      if (!card || card.userId !== req.user!.uid) {
        // throw to keep the transaction clean
        throw new Error('NOT_FOUND');
      }

      // 2) slug uniqueness (if changed)
      if (input.slug && input.slug !== card.slug) {
        const exists = await tx.digitalNameCard.findUnique({
          where: { slug: input.slug },
          select: { id: true }
        });
        if (exists) throw new Error('SLUG_EXISTS');
      }

      // 3) split socials from base patch
      const { socials, ...patch } = input;

      // 4) manage publishedAt transitions
      const nextPublishedAt =
        patch.publishStatus === 'PUBLISHED' && !card.publishedAt
          ? new Date()
          : patch.publishStatus === 'DRAFT'
          ? null
          : card.publishedAt;

      // 5) update base fields
      await tx.digitalNameCard.update({
        where: { id },
        data: {
          ...patch,
          publishedAt: nextPublishedAt
        }
      });

      // 6) replace socials if provided
      if (Array.isArray(socials)) {
        await tx.socialAccount.deleteMany({ where: { cardId: id } });
        if (socials.length > 0) {
          await tx.socialAccount.createMany({
            data: socials.map(s => ({
              cardId: id,
              platform: s.platform,
              handle: s.handle,
              url: s.url,
              label: s.label,
              isPublic: typeof s.isPublic === 'boolean' ? s.isPublic : true,
              sortOrder: typeof s.sortOrder === 'number' ? s.sortOrder : 0
            }))
          });
        }
      }

      // 7) return final
      return tx.digitalNameCard.findUnique({
        where: { id },
        include: { socials: true }
      });
    });

    return sendSuccess(
      res,
      serializeCard(updated, { isOwner: true }),
      'Card updated'
    );
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return sendNotFound(res, 'Card not found');
    if (e?.message === 'SLUG_EXISTS')
      return sendConflict(res, 'Slug already exists');
    return sendError(res, e?.message ?? 'Failed to update card');
  }
}

/** DELETE /api/digital-name-cards/:id — owner delete (controller-only ownership) */
export async function deleteCard(req: Request, res: Response) {
  if (!req.user?.uid) return sendUnauthorized(res);
  const { id } = req.params;

  try {
    await prisma.$transaction(async tx => {
      // own check
      const card = await tx.digitalNameCard.findUnique({
        where: { id },
        select: { id: true, userId: true }
      });
      if (!card || card.userId !== req.user!.uid) throw new Error('NOT_FOUND');

      await tx.socialAccount.deleteMany({ where: { cardId: id } });
      await tx.digitalNameCard.delete({ where: { id } });
    });

    return sendSuccess(res, { id }, 'Card deleted');
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return sendNotFound(res, 'Card not found');
    return sendError(res, e?.message ?? 'Failed to delete card');
  }
}

/** GET /api/digital-name-card/slug/:slug — public (published only) */
export async function getPublicCardBySlug(req: Request, res: Response) {
  const { slug } = req.params;
  try {
    const card = await prisma.digitalNameCard.findUnique({
      where: { slug },
      include: { socials: true }
    });
    if (!card || card.publishStatus !== 'PUBLISHED') {
      return sendNotFound(res, 'Card not found');
    }
    const isOwner = req.user?.uid === card.userId; // if session cookie present for owner
    return sendSuccess(res, serializeCard(card, { isOwner }), 'Card');
  } catch (e: any) {
    return sendError(res, e?.message ?? 'Failed to fetch card');
  }
}
