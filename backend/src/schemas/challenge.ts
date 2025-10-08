// src/schemas/challenge.ts
import { z } from 'zod';
import { zOptionalDate } from './_date';

/** Shared */
export const challengeImageSchema = z.object({
  key: z.string().min(1),
  url: z.string().url(),
  sortOrder: z.number().int().min(0).max(999).optional()
});

export const prizeSchema = z.object({
  rank: z.number().int().min(1),
  label: z.string().min(1).max(120).optional(),
  amountCents: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional()
});

/** Create Challenge */
export const createChallengeSchema = z.object({
  slug: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  brandName: z.string().max(200).optional(),
  brandLogoKey: z.string().max(255).optional(),
  postingUrl: z.string().url().optional(),
  targetPlatforms: z.array(z.string().min(1)).max(10).optional(), // ["tiktok","instagram"]
  goalViews: z.number().int().min(0).optional(),
  goalLikes: z.number().int().min(0).optional(),

  // Accept "YYYY-MM-DD" or full ISO or Date; outputs ISO or null
  deadline: zOptionalDate.optional().nullable(),

  publishStatus: z.enum(['DRAFT', 'PRIVATE', 'PUBLISHED']).optional(),
  status: z.enum(['OPEN', 'CLOSED', 'ARCHIVED']).optional(),

  images: z.array(challengeImageSchema).max(6).optional(),
  prizes: z.array(prizeSchema).max(10).optional()
});
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

/** Update Challenge */
export const updateChallengeSchema = z.object({
  slug: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  brandName: z.string().max(200).nullable().optional(),
  brandLogoKey: z.string().max(255).nullable().optional(),
  postingUrl: z.string().url().nullable().optional(),
  targetPlatforms: z.array(z.string().min(1)).max(10).nullable().optional(),
  goalViews: z.number().int().min(0).nullable().optional(),
  goalLikes: z.number().int().min(0).nullable().optional(),

  // Accept "YYYY-MM-DD" or full ISO or Date; outputs ISO or null
  deadline: zOptionalDate.nullable().optional(),

  publishStatus: z.enum(['DRAFT', 'PRIVATE', 'PUBLISHED']).optional(),
  status: z.enum(['OPEN', 'CLOSED', 'ARCHIVED']).optional(),

  images: z.array(challengeImageSchema).max(6).optional(),
  prizes: z.array(prizeSchema).max(10).optional()
});
export type UpdateChallengeInput = z.infer<typeof updateChallengeSchema>;

/** Create Submission (no username here) */
export const submitEntrySchema = z.object({
  platform: z.string().min(1), // "tiktok" | "instagram" | "youtube"
  linkUrl: z.string().url().nullable().optional(),
  imageKey: z.string().min(1).nullable().optional(),
  notes: z.string().max(1000).nullable().optional()
});
export type SubmitEntryInput = z.infer<typeof submitEntrySchema>;
