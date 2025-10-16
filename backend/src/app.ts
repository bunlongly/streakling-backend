// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { attachUserFromSession } from './middlewares/session.js';
import indexRoutes from './routes/indexRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import digitalCardRoutes from './routes/digitalNameCardRoutes.js';
import uploadsRoutes from './routes/uploadRoutes.js';
import { errorHandler } from './middlewares/error.js';
import portfolioRoutes from './routes/portfolioRoutes.js';
import challengeRoutes from './routes/challengeRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();

// If running on Vercel, the function already lives at /api
// so don't double-prefix; otherwise use '/api' locally.
const BASE = process.env.VERCEL ? '' : '/api';

/* Security & essentials */
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

/* Rate limit */
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false
  })
);

/* Attach req.user from signed cookie if present */
app.use(attachUserFromSession);

/* Routes */
app.use(BASE, uploadsRoutes);
app.use(BASE, healthRoutes);
app.use(BASE, indexRoutes);
app.use(BASE, sessionRoutes);
app.use(BASE, profileRoutes);
app.use(BASE, digitalCardRoutes);
app.use(BASE, portfolioRoutes);
app.use(BASE, challengeRoutes);
app.use(`${BASE}/admin`, adminRoutes);

/* 404 */
app.use((_req, res) => {
  res.status(404).json({ status: 'fail', message: 'Route not found' });
});

/* Error handler */
app.use(errorHandler);

export default app;
