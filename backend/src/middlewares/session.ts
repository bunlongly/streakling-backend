import type { Request, Response, NextFunction } from 'express';
import { readSessionCookie } from '../utils/sessionCookie.js';

export function attachUserFromSession(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  (req as any).user = readSessionCookie(req); 
  next();
}

export function requireSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!(req as any).user) {
    return res.status(401).json({ status: 'fail', message: 'Unauthorized' });
  }
  next();
}
