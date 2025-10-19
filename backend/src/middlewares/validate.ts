import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { sendBadRequest } from '../utils/responseHandler';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendBadRequest(res, 'Validation error', parsed.error.format());
    }
    // overwrite with parsed data (strips unknown)
    req.body = parsed.data as any;
    next();
  };
}
