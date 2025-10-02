import { Response } from 'express';

export type ResponseData<T> = {
  status: 'success' | 'fail' | 'error';
  message: string;
  data?: T;
  errors?: any;
};

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Request successful',
  statusCode = 200
) => res.status(statusCode).json({ status: 'success', message, data });

export const sendCreated = <T>(
  res: Response,
  data: T,
  message = 'Resource created successfully'
) => sendSuccess(res, data, message, 201);

export const sendAccepted = <T>(
  res: Response,
  data: T,
  message = 'Request accepted'
) => sendSuccess(res, data, message, 202);

export const sendNoContent = (res: Response) => res.status(204).send();

export const sendBadRequest = (
  res: Response,
  message = 'Bad request',
  errors?: any
) => res.status(400).json({ status: 'fail', message, errors });

export const sendUnauthorized = (res: Response, message = 'Unauthorized') =>
  res.status(401).json({ status: 'fail', message });

export const sendForbidden = (res: Response, message = 'Forbidden') =>
  res.status(403).json({ status: 'fail', message });

export const sendNotFound = (res: Response, message = 'Resource not found') =>
  res.status(404).json({ status: 'fail', message });

export const sendConflict = (res: Response, message = 'Conflict') =>
  res.status(409).json({ status: 'fail', message });

export const sendError = (
  res: Response,
  message = 'Internal server error',
  statusCode = 500,
  errors?: any
) => res.status(statusCode).json({ status: 'error', message, errors });
