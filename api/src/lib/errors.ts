import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger.js';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = 'http_error',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const NotFound = (resource: string): HttpError =>
  new HttpError(404, `${resource} not found`, 'not_found');

export const BadRequest = (message: string, details?: unknown): HttpError =>
  new HttpError(400, message, 'bad_request', details);

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'route_not_found'));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'validation_error',
      message: 'Request failed validation',
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof HttpError) {
    if (err.status >= 500) {
      logger.error({ err, path: req.originalUrl }, err.message);
    }
    res.status(err.status).json({
      error: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  logger.error({ err, path: req.originalUrl }, 'unhandled error');
  res.status(500).json({ error: 'internal_error', message: 'An unexpected error occurred' });
};
