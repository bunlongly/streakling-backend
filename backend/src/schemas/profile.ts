import { z } from 'zod';

/** helper: '' -> undefined */
const emptyToUndef = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

/** optional trimmed string, '' -> undefined */
const optTrimUndef = z.preprocess(emptyToUndef, z.string().trim().optional());

/** username: optional, 3–30, a-z0-9_- */
const usernameSchema = z.preprocess(
  emptyToUndef,
  z
    .string()
    .trim()
    .regex(
      /^[a-z0-9_-]{3,30}$/i,
      'Use 3–30 letters, numbers, underscore or dash'
    )
    .optional()
);

/** date: 'YYYY-MM-DD' or undefined */
const dateStringSchema = z.preprocess(
  emptyToUndef,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
);

/** images: allow null to CLEAR column */
const nullableKey = z.union([z.string().trim().min(1), z.null()]).optional();

/** industries: accept array OR comma-separated string; normalize to string[] */
const industriesInput = z
  .union([
    z.array(z.string().min(1)),
    z.preprocess(
      v =>
        typeof v === 'string'
          ? v
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : v,
      z.array(z.string().min(1))
    )
  ])
  .optional();

export const updateMyProfileSchema = z
  .object({
    // identity
    username: usernameSchema,
    displayName: optTrimUndef,

    // contact/meta
    email: z.preprocess(emptyToUndef, z.string().email().optional()),
    phone: optTrimUndef,
    country: optTrimUndef,
    religion: optTrimUndef,
    dateOfBirth: dateStringSchema,

    // media
    avatarKey: nullableKey,
    bannerKey: nullableKey,

    // privacy
    showEmail: z.boolean().optional(),
    showReligion: z.boolean().optional(),
    showDateOfBirth: z.boolean().optional(),
    showPhone: z.boolean().optional(),
    showCountry: z.boolean().optional(),

    // industries normalized to string[]
    industries: industriesInput
  })
  .strict();

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
