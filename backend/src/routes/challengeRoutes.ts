import { Router } from 'express';
import { requireSession } from '../middlewares/session';
import { validateBody } from '../middlewares/validate';
import {
  createChallenge,
  listMyChallenges,
  getMyChallengeById,
  updateChallenge,
  deleteChallenge,
  listPublicChallenges,
  getPublicChallengeBySlug,
  createSubmission,
  listSubmissions,
  listMySubmissions,
  withdrawMySubmission,
  updateSubmissionStatus
} from '../controllers/challengeController';
import {
  createChallengeSchema,
  updateChallengeSchema,
  submitEntrySchema
} from '../schemas/challenge';

const router = Router();

/** Public listing & fetch by slug */
router.get('/challenges/public', listPublicChallenges);
router.get('/challenges/slug/:slug', getPublicChallengeBySlug);

/** Owner CRUD */
router.post(
  '/challenges',
  requireSession,
  validateBody(createChallengeSchema),
  createChallenge
);
router.get('/challenges', requireSession, listMyChallenges);
router.get('/challenges/:id', requireSession, getMyChallengeById);
router.patch(
  '/challenges/:id',
  requireSession,
  validateBody(updateChallengeSchema),
  updateChallenge
);
router.delete('/challenges/:id', requireSession, deleteChallenge);

/** Submissions */
// Create my submission
router.post(
  '/challenges/:id/submissions',
  requireSession,
  validateBody(submitEntrySchema),
  createSubmission
);

// Public ordered list OR mine via ?mine=1 (quiet 200 + null when not submitted)
router.get('/challenges/:id/submissions', listSubmissions);

// Withdraw my submission (no /me in path)
router.delete(
  '/challenges/:id/submissions',
  requireSession,
  withdrawMySubmission
);

// List all my submissions across challenges
router.get('/submissions', requireSession, listMySubmissions);

/** Owner moderation of submissions */
router.patch(
  '/challenges/:challengeId/submissions/:submissionId/status',
  requireSession,
  updateSubmissionStatus
);

export default router;
