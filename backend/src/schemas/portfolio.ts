// src/schemas/portfolio.ts
import { z } from 'zod';

const SocialPlatform = z.enum([
  'TWITTER',
  'INSTAGRAM',
  'FACEBOOK',
  'LINKEDIN',
  'TIKTOK',
  'YOUTUBE',
  'GITHUB',
  'PERSONAL',
  'OTHER'
]);
const PublishStatus = z.enum(['DRAFT', 'PRIVATE', 'PUBLISHED']);

// helper: normalize null -> undefined (keeps your TS happy)
const nullableToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  schema.nullable().transform(v => (v == null ? undefined : v));

const subImageSchema = z.object({
  key: z.string().min(1),
  url: z.string().url(),
  sortOrder: z.number().int().min(0).optional()
});

const videoLinkSchema = z.object({
  platform: SocialPlatform,
  url: z.string().url(),
  description: nullableToUndef(z.string().max(300).optional())
});

const projectSchema = z.object({
  title: z.string().min(1).max(160),
  description: nullableToUndef(z.string().max(4000).optional()),
  mainImageKey: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  subImages: z.array(subImageSchema).optional(),
  videoLinks: z.array(videoLinkSchema).optional()
});

export const createPortfolioSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(60)
    .optional(),
  title: z.string().min(1).max(120),
  description: nullableToUndef(z.string().max(2000).optional()),
  mainImageKey: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),

  subImages: z.array(subImageSchema).optional(),
  videoLinks: z.array(videoLinkSchema).optional(),
  projects: z.array(projectSchema).optional(),

  publishStatus: PublishStatus.optional()
});

export const updatePortfolioSchema = createPortfolioSchema.partial();

export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;
export type UpdatePortfolioInput = z.infer<typeof updatePortfolioSchema>;
