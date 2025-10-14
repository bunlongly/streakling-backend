import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { readSessionCookie } from '../utils/sessionCookie';

export async function adminOnly(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sess = readSessionCookie(req);
  if (!sess) {
    return res.status(401).json({ status: 'fail', message: 'Unauthorized' });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: sess.uid },
    select: { role: true }
  });

  if (!dbUser || dbUser.role !== 'ADMIN') {
    return res
      .status(403)
      .json({ status: 'fail', message: 'Forbidden: admin only' });
  }
  next();
}
