// src/controllers/adminController.ts
import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';

function takeParam(req: Request, key: string, fallback: number) {
  const v = Number(req.query[key]);
  return Number.isFinite(v) && v > 0 ? Math.min(v, 200) : fallback;
}

/** Simple totals for top tiles (no Profile model) */
export async function getStats(_req: Request, res: Response) {
  const [users, challenges, digitalCards, portfolios] = await Promise.all([
    prisma.user.count(),
    prisma.challenge.count(),
    prisma.digitalNameCard.count(),
    prisma.portfolio.count()
  ]);
  res.json({
    ok: true,
    data: { users, challenges, digitalCards, portfolios }
  });
}

export async function listUsers(req: Request, res: Response) {
  const take = takeParam(req, 'limit', 10);
  const cursor = req.query.cursor as string | undefined;

  const rows = await prisma.user.findMany({
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      displayName: true, // <- use displayName instead of name
      role: true,
      createdAt: true
    }
  });

  const nextCursor = rows.length > take ? rows[take].id : null;
  res.json({ ok: true, data: { items: rows.slice(0, take), nextCursor } });
}

export async function listChallenges(req: Request, res: Response) {
  const take = takeParam(req, 'limit', 10);
  const cursor = req.query.cursor as string | undefined;

  const rows = await prisma.challenge.findMany({
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      _count: { select: { submissions: true } }
    }
  });

  const nextCursor = rows.length > take ? rows[take].id : null;
  res.json({ ok: true, data: { items: rows.slice(0, take), nextCursor } });
}

export async function listDigitalCards(req: Request, res: Response) {
  const take = takeParam(req, 'limit', 10);
  const cursor = req.query.cursor as string | undefined;

  const rows = await prisma.digitalNameCard.findMany({
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      firstName: true,
      lastName: true,
      publishStatus: true,
      userId: true,
      createdAt: true
    }
  });

  const nextCursor = rows.length > take ? rows[take].id : null;
  res.json({ ok: true, data: { items: rows.slice(0, take), nextCursor } });
}

export async function listPortfolios(req: Request, res: Response) {
  const take = takeParam(req, 'limit', 10);
  const cursor = req.query.cursor as string | undefined;

  const rows = await prisma.portfolio.findMany({
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      publishStatus: true,
      userId: true,
      createdAt: true
    }
  });

  const nextCursor = rows.length > take ? rows[take].id : null;
  res.json({ ok: true, data: { items: rows.slice(0, take), nextCursor } });
}

/** If you want an admin "profiles" list, alias it to users (since there is no Profile model) */
export async function listProfiles(req: Request, res: Response) {
  return listUsers(req, res);
}
