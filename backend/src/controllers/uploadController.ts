import type { Request, Response } from 'express';
import {
  sendBadRequest,
  sendSuccess,
  sendUnauthorized,
  sendError
} from '../utils/reponseHandller';
import { getPresignedPutUrl } from '../services/s3UploadService';
import type { SignUploadInput } from '../schemas/upload';

export async function signImageUpload(req: Request, res: Response) {
  if (!req.user?.uid) return sendUnauthorized(res);

  try {
    const body = req.body as SignUploadInput;
    const { key, uploadUrl, url } = await getPresignedPutUrl({
      userId: req.user.uid,
      category: body.category,
      purpose: body.purpose,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      ext: body.ext
    });
    return sendSuccess(res, { key, uploadUrl, url }, 'Upload URL created');
  } catch (err: any) {
    if (err?.message?.includes('Unsupported content type')) {
      return sendBadRequest(
        res,
        'Unsupported image type. Use jpg, png, webp, or avif.'
      );
    }
    if (err?.message?.includes('File too large')) {
      return sendBadRequest(res, err.message);
    }
    return sendError(res, err?.message ?? 'Failed to create upload URL');
  }
}
