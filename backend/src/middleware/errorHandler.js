'use strict';

const multer = require('multer');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { fail } = require('../utils/respond');
const { env } = require('../config');
const { cleanupFile } = require('./upload');

/** 404 for anything that fell through the router. */
function notFoundHandler(req, res) {
  return fail(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`);
}

/** Translates whatever was thrown into { status, code, message, details }. */
function normalise(err) {
  if (err instanceof ApiError) {
    return { status: err.status, code: err.code, message: err.message, details: err.details };
  }

  // mongoose validation
  if (err && err.name === 'ValidationError' && err.errors) {
    return {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'One or more fields are invalid',
      details: Object.entries(err.errors).map(([field, e]) => ({ field, message: e.message })),
    };
  }

  // mongoose cast error (bad ObjectId etc.)
  if (err && err.name === 'CastError') {
    return { status: 400, code: 'INVALID_ID', message: `'${err.value}' is not a valid ${err.path}` };
  }

  // duplicate key
  if (err && (err.code === 11000 || err.code === 11001)) {
    const fields = Object.keys(err.keyValue || {});
    return {
      status: 409,
      code: 'DUPLICATE_KEY',
      message: fields.length
        ? `${fields.join(', ')} already exists`
        : 'That record already exists',
      details: err.keyValue,
    };
  }

  // jsonwebtoken
  if (err && err.name === 'TokenExpiredError') {
    return { status: 401, code: 'TOKEN_EXPIRED', message: 'Token has expired' };
  }
  if (err && (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError')) {
    return { status: 401, code: 'INVALID_TOKEN', message: 'Invalid or malformed token' };
  }

  // multer
  if (err instanceof multer.MulterError) {
    const map = {
      LIMIT_FILE_SIZE: { status: 413, code: 'FILE_TOO_LARGE', message: `File exceeds the ${env.MAX_UPLOAD_MB}MB limit` },
      LIMIT_FILE_COUNT: { status: 400, code: 'TOO_MANY_FILES', message: 'Only one file per request' },
      LIMIT_UNEXPECTED_FILE: { status: 400, code: 'UNEXPECTED_FILE', message: `Unexpected file field '${err.field}' — use 'file'` },
    };
    return map[err.code] || { status: 400, code: `UPLOAD_${err.code}`, message: err.message };
  }

  // body-parser / express
  if (err && err.type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_JSON', message: 'Request body is not valid JSON' };
  }
  if (err && err.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' };
  }
  if (err && err.message === 'CORS_NOT_ALLOWED') {
    return { status: 403, code: 'CORS_NOT_ALLOWED', message: 'Origin is not allowed by CORS' };
  }

  return {
    status: err && Number.isInteger(err.status) ? err.status : 500,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong on our side',
  };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // An upload that failed downstream leaves a stray temp file behind.
  if (req.file) cleanupFile(req.file);

  const { status, code, message, details } = normalise(err);

  const logPayload = {
    method: req.method,
    url: req.originalUrl,
    status,
    code,
    userId: req.user ? String(req.user._id) : undefined,
  };
  if (status >= 500) logger.error({ ...logPayload, err: { message: err.message, stack: err.stack } }, message);
  else logger.warn({ ...logPayload, msg: err.message }, 'request failed');

  // Never leak internals in production.
  const safeMessage = status >= 500 && env.isProd ? 'Something went wrong on our side' : message;
  const body = details !== undefined ? details : undefined;

  if (!env.isProd && status >= 500) {
    return fail(res, status, code, safeMessage, { stack: String(err.stack || '').split('\n').slice(0, 6) });
  }
  return fail(res, status, code, safeMessage, body);
}

module.exports = { errorHandler, notFoundHandler, normalise };
