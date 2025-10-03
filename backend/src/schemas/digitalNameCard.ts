import { z } from 'zod';

export const cardStatusEnum = z.enum(['STUDENT', 'GRADUATE', 'WORKING']);
export const publishStatusEnum = z.enum(['DRAFT', 'PUBLISHED']);

export const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(60, 'Max 60 characters')
  .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only');

export const createDigitalCardSchema = z.object({
  slug: slugSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  appName: z.string().min(1).max(50),
  status: cardStatusEnum,
  role: z.string().min(1).max(80),
  shortBio: z.string().max(200),

  company: z.string().optional().nullable(),
  university: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  religion: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),

  avatarKey: z.string().optional().nullable(),
  bannerKey: z.string().optional().nullable(),

  // visibility flags
  showPhone: z.boolean().optional().default(false),
  showReligion: z.boolean().optional().default(false),
  showCompany: z.boolean().optional().default(true),
  showUniversity: z.boolean().optional().default(true),
  showCountry: z.boolean().optional().default(true),

  publishStatus: publishStatusEnum.default('DRAFT')
});

export const updateDigitalCardSchema = createDigitalCardSchema
  .partial()
  .extend({
    publishStatus: publishStatusEnum.optional()
  });

export type CreateDigitalCardInput = z.infer<typeof createDigitalCardSchema>;
export type UpdateDigitalCardInput = z.infer<typeof updateDigitalCardSchema>;
