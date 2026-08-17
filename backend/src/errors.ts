export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}
export class ConfigurationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(503, "CONFIGURATION_ERROR", message, details);
  }
}
export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(401, "AUTHENTICATION_REQUIRED", message);
  }
}
export class AuthorizationError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(403, "FORBIDDEN", message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}
export class UpstreamError extends AppError {
  constructor(message: string, details?: unknown, status = 502) {
    super(status, "UPSTREAM_ERROR", message, details);
  }
}
export class UnsafeContentError extends AppError {
  constructor(message = "Unsafe content was rejected") {
    super(422, "UNSAFE_CONTENT", message);
  }
}
