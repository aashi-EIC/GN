import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const validCorrelationId = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
export const correlation: RequestHandler = (req, res, next) => {
  const supplied = req.header("x-correlation-id");
  const correlationId = supplied && validCorrelationId.test(supplied) ? supplied : randomUUID();
  Object.assign(req, { correlationId });
  res.setHeader("x-correlation-id", correlationId);
  next();
};
