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
  //   deletePortfolio,
  getPublicPortfolioBySlug
} from '../controllers/portfolioController';

const router = Router();

/** ---- PUBLIC ---- */
router.get('/portfolios/slug/:slug', getPublicPortfolioBySlug); // ← no session

/** ---- AUTHENTICATED ---- */
router.use(requireSession);

router.post(
  '/portfolios',
  validateBody(createPortfolioSchema),
  createPortfolio
);
router.get('/portfolios', listPortfoliosMine);
router.get('/portfolios/:id', getMyPortfolioById);
router.patch(
  '/portfolios/:id',
  validateBody(updatePortfolioSchema),
  updatePortfolio
);
// router.delete('/portfolios/:id', deletePortfolio);

export default router;
