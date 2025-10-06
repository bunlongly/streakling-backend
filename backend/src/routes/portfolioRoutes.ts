// src/routes/portfolioRoutes.ts
import { Router } from 'express';
import { requireSession } from '../middlewares/session';
import { validateBody } from '../middlewares/validate';
import {
  createPortfolioSchema,
  updatePortfolioSchema
} from '../schemas/portfolio';
import {
  createPortfolio,
  listPortfoliosMine,
  getMyPortfolioById,
  updatePortfolio,
  deletePortfolio,
  getPublicPortfolioBySlug,
  prefillPortfolioFromCard,
  listPublicPortfolios
} from '../controllers/portfolioController';

const router = Router();

/** ---- PUBLIC ---- */
router.get('/portfolios/slug/:slug', getPublicPortfolioBySlug);
router.get('/portfolios/public', listPublicPortfolios);

router.get(
  '/portfolios/prefill-from-card/:cardId',
  requireSession,
  prefillPortfolioFromCard
);

router.post(
  '/portfolios',
  requireSession,
  validateBody(createPortfolioSchema),
  createPortfolio
);
router.get('/portfolios', requireSession, listPortfoliosMine);
router.get('/portfolios/:id', requireSession, getMyPortfolioById);
router.patch(
  '/portfolios/:id',
  requireSession,
  validateBody(updatePortfolioSchema),
  updatePortfolio
);
router.delete('/portfolios/:id', requireSession, deletePortfolio);

export default router;
