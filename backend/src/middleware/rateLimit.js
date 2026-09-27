'use strict';

const rateLimit = require('express-rate-limit');
const { env } = require('../config');
const { fail } = require('../utils/respond');

const handler = (req, res) => fail(
  res,
  429,
  'RATE_LIMITED',
  'Too many requests — please slow down and try again shortly.',
);

const common = {
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  // Never throttle the dev loop into uselessness.
  skip: () => false,
};

/** Loose global limiter for the whole /api surface. */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isProd ? 300 : 5000,
  ...common,
});

/** Stricter limiter for /api/auth/* — brute-force and OTP-spam protection. */
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: env.isProd ? 30 : 500,
  ...common,
});

/** Tightest limiter for the OTP issue endpoints. */
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: env.isProd ? 10 : 500,
  ...common,
});

/** Upload limiter — big multipart bodies are expensive. */
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isProd ? 30 : 500,
  ...common,
});

module.exports = { apiLimiter, authLimiter, otpLimiter, uploadLimiter };
