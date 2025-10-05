// src/schemas/digitalNameCard.ts
import { z } from 'zod';

/** Helper: treat empty string as undefined so optional() works with form inputs */
const emptyToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    schema
  );

const emptyStr = emptyToUndef(z.string());
const emptyUrl = emptyToUndef(z.string().url());

export const socialPlatformEnum = z.enum([
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

export const socialAccountSchema = z.object({
  // If you strictly use CUID in Prisma, keep the next line as-is.
  // If your DB might produce uuid/cuid2/other strings, use the union below.
  // id: z.string().cuid().optional(),
  id: z.union([z.string().cuid(), z.string().uuid(), z.string()]).optional(),

  platform: socialPlatformEnum,

  // Optional text fields ('' -> undefined so optional passes)
  handle: emptyToUndef(z.string().min(1).max(100)).optional(),
  url: emptyUrl.optional(),
  label: emptyToUndef(z.string().max(50)).optional(),

  isPublic: z.boolean().default(true).optional(),
  sortOrder: z.number().int().min(0).default(0).optional()
});

export const createDigitalCardSchema = z.object({
  slug: z.string().min(3).max(64),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  appName: z.string().min(1),
  status: z.enum(['STUDENT', 'GRADUATE', 'WORKING']),
  role: z.string().min(1),
  shortBio: z.string().min(1).max(300),

  // Optional profile fields ('' -> undefined)
  company: emptyStr.optional(),
  university: emptyStr.optional(),
  country: emptyStr.optional(),
  religion: emptyStr.optional(),
  phone: emptyStr.optional(),

  // Optional visibility flags—client sends true/false already
  showPhone: z.boolean().optional(),
  showReligion: z.boolean().optional(),
  showCompany: z.boolean().optional(),
  showUniversity: z.boolean().optional(),
  showCountry: z.boolean().optional(),

  // Media keys ('' -> undefined)
  avatarKey: emptyStr.optional(),
  bannerKey: emptyStr.optional(),

  publishStatus: z.enum(['DRAFT', 'PRIVATE', 'PUBLISHED']).default('DRAFT'),

  socials: z.array(socialAccountSchema).optional().default([])
});

export type CreateDigitalCardInput = z.infer<typeof createDigitalCardSchema>;

export const updateDigitalCardSchema = createDigitalCardSchema
  .partial()
  .extend({
    /**
     * If true, the server should replace existing socials with the provided array.
     * If false/undefined, the server may do a partial update/merge strategy.
     */
    replaceSocials: z.boolean().optional()
  });

export type UpdateDigitalCardInput = z.infer<typeof updateDigitalCardSchema>;
