'use strict';

const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const tokenService = require('../services/tokenService');

function readToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  // Handy for <video src> / <img src> style requests that cannot set a header.
  if (req.query && typeof req.query.access_token === 'string') return req.query.access_token;
  return null;
}

/** Verifies the token, re-checks tokenVersion against the DB, attaches req.user. */
async function resolveUser(token) {
  const { User } = require('../models');
  const payload = tokenService.verifyAccessToken(token);
  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'INVALID_TOKEN', 'Account no longer exists');
  if (!user.isActive) throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  if ((user.tokenVersion || 0) !== (payload.tokenVersion || 0)) {
    throw new ApiError(401, 'TOKEN_REVOKED', 'Session was revoked — please sign in again');
  }
  return { user, payload };
}

/** Hard gate: 401 unless a valid access token is present. */
const requireAuth = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw new ApiError(401, 'NO_TOKEN', 'Authentication required');
  const { user, payload } = await resolveUser(token);
  req.user = user;
  req.auth = payload;
  next();
});

/** Soft gate: attaches req.user when a valid token is present, never fails. */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) return next();
  try {
    const { user, payload } = await resolveUser(token);
    req.user = user;
    req.auth = payload;
  } catch (_err) {
    // A bad token on a public endpoint is simply treated as anonymous.
    req.user = undefined;
  }
  return next();
});

/** Role gate. Use AFTER requireAuth: requireRole('trainer','admin'). */
const requireRole = (...roles) => {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'NO_TOKEN', 'Authentication required'));
    if (!allowed.includes(req.user.role)) {
      return next(new ApiError(403, 'FORBIDDEN', `This endpoint requires role: ${allowed.join(' or ')}`));
    }
    return next();
  };
};

/** Convenience for verified-only endpoints. */
const requireVerified = (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'NO_TOKEN', 'Authentication required'));
  if (!req.user.isVerified) return next(new ApiError(403, 'NOT_VERIFIED', 'Verify your account first'));
  return next();
};

module.exports = { requireAuth, optionalAuth, requireRole, requireVerified, readToken, resolveUser };
