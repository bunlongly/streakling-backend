import { Router } from 'express';
import { requireSession } from '../middlewares/session';
import { validateBody } from '../middlewares/validate';
import {
  createDigitalCardSchema,
  updateDigitalCardSchema
} from '../schemas/digitalNameCard';
import {
  createCard,
  getPublicCardBySlug,
  listMyCards,
  updateCard
} from '../controllers/digitalNameCardController';

const router = Router();

/** Owner CRUD */
router.post(
  '/digital-name-cards',
  requireSession,
  validateBody(createDigitalCardSchema),
  createCard
);
router.get('/me/digital-name-cards', requireSession, listMyCards);
router.patch(
  '/digital-name-cards/:id',
  requireSession,
  validateBody(updateDigitalCardSchema),
  updateCard
);

/** Public */
// Public by vanity slug
router.get('/digital-name-card/slug/:slug', getPublicCardBySlug);

export default router;
