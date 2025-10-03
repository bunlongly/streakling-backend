import { Router } from 'express';
import { requireSession } from '../middlewares/session';
import { validateBody } from '../middlewares/validate';
import { signUploadSchema } from '../schemas/upload';
import { signImageUpload } from '../controllers/uploadController';

const router = Router();

router.post('/uploads/sign', requireSession, validateBody(signUploadSchema), signImageUpload);

export default router;
