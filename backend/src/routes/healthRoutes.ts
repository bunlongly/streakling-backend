import { Router } from 'express';
import { sendSuccess } from '../utils/reponseHandller';

const router = Router();

router.get('/health', (_req, res) => {
  // Keep it simple but useful for probes
  return sendSuccess(res, {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }, 'Healthy');
});

export default router;
