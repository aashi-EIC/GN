import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../errors.js';
import { logger } from '../../observability/logger.js';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const correlationId = (req as typeof req & { correlationId?: string }).correlationId;
  const appError = toAppError(error);
  const log = appError.status >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);

  log({ err: error, correlationId, code: appError.code, status: appError.status }, appError.message);

  if (res.headersSent) return;

  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.status < 500 && appError.details ? { details: appError.details } : {}),
      correlationId,
    },
  });
};

function toAppError(error: unknown) {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', error.flatten());
  }

  return new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}
