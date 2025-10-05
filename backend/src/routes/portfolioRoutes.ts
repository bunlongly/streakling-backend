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
  deletePortfolio
} from '../controllers/portfolioController';

const router = Router();

/** Owner CRUD (no /me prefix to match your digital-name-cards style) */
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
