// src/routes/profileRoutes.ts
import { Router } from 'express';
import { requireSession } from '../middlewares/session';
import { validateBody } from '../middlewares/validate';
import {
  getProfile,
  updateProfile,
  getPublicProfileByUsername,
  getPublicProfileById,
  listPublicProfiles
} from '../controllers/profileController';
import { updateMyProfileSchema } from '../schemas/profile';

const router = Router();

/** Public: by username or id */
router.get('/u/:username', getPublicProfileByUsername);
router.get('/u/id/:id', getPublicProfileById);
router.get('/profiles/public', listPublicProfiles);

/** Authenticated: self */
router.get('/profile', requireSession, getProfile);
router.patch(
  '/profile',
  requireSession,
  validateBody(updateMyProfileSchema),
  updateProfile
);

export default router;
