// src/schemas/portfolio.ts
import { z } from 'zod';

const emptyToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(v => (v === '' ? undefined : v), schema);

// Keep enum subset flexible (maps to your SocialPlatform at DB level)
export const videoPlatformEnum = z.enum([
  'TIKTOK',
  'YOUTUBE',
  'TWITTER',
  'INSTAGRAM',
  'FACEBOOK',
  'LINKEDIN',
  'GITHUB',
  'PERSONAL',
  'OTHER'
]);

export const portfolioImageSchema = z.object({
  id: z.string().cuid().optional(),
  key: z.string().min(1),
  url: z.string().url(),
  sortOrder: z.number().int().optional()
});

export const portfolioVideoSchema = z.object({
  id: z.string().cuid().optional(),
  platform: videoPlatformEnum,
  url: z.string().url(),
  durationSeconds: z
    .number()
    .int()
    .positive()
    .max(180, 'Video must be 3 minutes (180s) or less')
    .optional(),
  thumbnailUrl: emptyToUndef(z.string().url().optional())
});

export const createPortfolioSchema = z.object({
  title: z.string().min(1).max(120),
  description: emptyToUndef(z.string().max(2000).optional()),
  mainImageKey: emptyToUndef(z.string().optional()),
  subImages: z.array(portfolioImageSchema).max(12).optional(),
  videoLinks: z.array(portfolioVideoSchema).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional()
});

export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;

// PATCH-friendly: every field optional; arrays fully replace existing when provided
export const updatePortfolioSchema = createPortfolioSchema.partial();

export type UpdatePortfolioInput = z.infer<typeof updatePortfolioSchema>;
