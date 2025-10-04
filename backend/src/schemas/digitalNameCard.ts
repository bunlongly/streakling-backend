// src/schemas/digitalNameCard.ts
import { z } from 'zod';

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
  id: z.string().cuid().optional(), // only for update (client may send)
  platform: socialPlatformEnum,
  handle: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  label: z.string().max(50).optional(), // used when platform=OTHER/PERSONAL
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
  company: z.string().optional(),
  university: z.string().optional(),
  country: z.string().optional(),
  religion: z.string().optional(),
  phone: z.string().optional(),

  showPhone: z.boolean().optional(),
  showReligion: z.boolean().optional(),
  showCompany: z.boolean().optional(),
  showUniversity: z.boolean().optional(),
  showCountry: z.boolean().optional(),

  avatarKey: z.string().optional(),
  bannerKey: z.string().optional(),
  publishStatus: z.enum(['DRAFT', 'PRIVATE', 'PUBLISHED']).default('DRAFT'),

  // NEW
  socials: z.array(socialAccountSchema).optional().default([])
});

export type CreateDigitalCardInput = z.infer<typeof createDigitalCardSchema>;

export const updateDigitalCardSchema = createDigitalCardSchema
  .partial()
  .extend({
    // optional strategy: replace all socials in update
    replaceSocials: z.boolean().optional()
  });

export type UpdateDigitalCardInput = z.infer<typeof updateDigitalCardSchema>;
