import { z } from 'zod';

export const signUploadSchema = z.object({
  category: z.enum(['digitalcard', 'portfolio', 'profile', 'challenge']),
  purpose: z.enum(['avatar', 'banner', 'cover', 'media']),
  contentType: z.string().min(1),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024)
    .optional(),
  ext: z
    .string()
    .regex(/^[a-z0-9]+$/i)
    .optional()
});

export type SignUploadInput = z.infer<typeof signUploadSchema>;
