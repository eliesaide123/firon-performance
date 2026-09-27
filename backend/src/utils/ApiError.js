'use strict';

/**
 * Application error carrying an HTTP status + a stable machine code.
 * Thrown from anywhere; formatted by middleware/errorHandler.js.
 */
class ApiError extends Error {
  constructor(status = 500, code = 'INTERNAL_ERROR', message = 'Something went wrong', details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
    this.expose = status < 500;
    Error.captureStackTrace(this, ApiError);
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'You do not have access to this resource', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }

  static conflict(message = 'Resource already exists', code = 'CONFLICT') {
    return new ApiError(409, code, message);
  }

  static validation(message = 'Validation failed', details) {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }
}

module.exports = ApiError;
