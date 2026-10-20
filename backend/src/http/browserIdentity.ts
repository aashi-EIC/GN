import type { Request } from "express";
import { z } from "zod";
import { AppError } from "../errors.js";

/** Anonymous pilot identity only. It cannot substitute for authenticated user claims. */
export function readBrowserUserId(request: Request, supplied?: string) {
  const header = z.string().uuid().optional().parse(request.get("x-browser-user-id"));
  const identity = z
    .string()
    .uuid()
    .parse(supplied ?? header)
    .toLowerCase();
  if (header && header.toLowerCase() !== identity) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Browser identity does not match request metadata.",
    );
  }
  return identity;
}
