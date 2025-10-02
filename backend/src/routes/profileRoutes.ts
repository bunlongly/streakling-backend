import { Router } from 'express';
import { sendSuccess, sendUnauthorized } from '../utils/reponseHandller'; // <-- fixed
import { requireSession } from '../middlewares/session.js';

const router = Router();

/** GET /api/profile — returns user from cookie session only */
router.get('/profile', requireSession, (req, res) => {
  if (!req.user) return sendUnauthorized(res);
  return sendSuccess(res, { user: req.user }, 'Profile from session');
});

export default router;
