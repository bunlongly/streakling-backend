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
  updateCard,
  getMyCardById,
  deleteCard,
  listPublishedCards
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

// handy for edit page prefill
router.get('/digital-name-cards/:id', requireSession, getMyCardById);

router.patch(
  '/digital-name-cards/:id',
  requireSession,
  validateBody(updateDigitalCardSchema),
  updateCard
);

/** Public */
// Public by vanity slug
router.get('/digital-name-card/slug/:slug', getPublicCardBySlug);

router.get('/digital-name-cards', listPublishedCards);

router.delete('/digital-name-cards/:id', requireSession, deleteCard);

export default router;
