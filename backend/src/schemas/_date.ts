// src/schemas/_date.ts
import { z } from 'zod';

/**
 * Accepts:
 *  - "YYYY-MM-DD"
 *  - full ISO datetime string
 *  - Date instance
 *  - null/undefined
 *
 * Returns:
 *  - null (if input nullish)
 *  - normalized ISO string in UTC
 */
export const zOptionalDate = z
  .union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // date-only (HTML date input)
    z.string().datetime(), // full ISO
    z.date(), // Date object
    z.null(),
    z.undefined()
  ])
  .transform(val => {
    if (val == null) return null;

    // "YYYY-MM-DD" → midnight UTC
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return new Date(`${val}T00:00:00.000Z`).toISOString();
    }

    // full ISO string
    if (typeof val === 'string') {
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) throw new Error('Invalid ISO datetime');
      return d.toISOString();
    }

    // Date instance
    const d = val as Date;
    if (Number.isNaN(d.getTime())) throw new Error('Invalid ISO datetime');
    return d.toISOString();
  });
