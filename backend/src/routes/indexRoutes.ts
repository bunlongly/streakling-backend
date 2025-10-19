import { Router } from 'express';
import { sendSuccess } from '../utils/responseHandler';

const router = Router();

router.get('/', (_req, res) => {
  return sendSuccess(res, { message: 'Hello, Streakling!' });
});

export default router;
