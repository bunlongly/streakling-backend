// src/routes/adminRoutes.ts
import { Router } from 'express';
import { requireSession } from '../middlewares/session';
import { adminOnly } from '../middlewares/adminOnly';
import {
  getStats,
  listUsers,
  listChallenges,
  listDigitalCards,
  listPortfolios
  // listProfiles // <- only if you keep the alias
} from '../controllers/adminController';

const r = Router();

r.use(requireSession, adminOnly);

r.get('/stats', getStats);
r.get('/users', listUsers);
r.get('/challenges', listChallenges);
r.get('/cards', listDigitalCards);
r.get('/portfolios', listPortfolios);

// Option A: remove this entirely (recommended if you don't use it)
// r.get('/profiles', listProfiles);

// Option B: keep alias to users
// r.get('/profiles', listProfiles);

export default r;
