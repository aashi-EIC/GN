import type { RequestHandler } from 'express';

export const cancellation: RequestHandler = (req, res, next) => {
  const controller = new AbortController();
  Object.assign(req, { requestSignal: controller.signal });
  req.once('aborted', () => controller.abort(new Error('Client aborted request')));
  res.once('close', () => { if (!res.writableEnded) controller.abort(new Error('Client connection closed')); });
  next();
};
