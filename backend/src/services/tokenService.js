'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { env } = require('../config');
const ApiError = require('../utils/ApiError');

const ISSUER = 'firon-performance';

/**
 * Access token payload (CONTRACT §3.3):
 *   { sub: userId, role, email, tokenVersion, iat, exp }
 */
function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id || user.id),
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion || 0,
      typ: 'access',
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL, issuer: ISSUER },
  );
}

function signRefreshToken(user, { remember = false } = {}) {
  return jwt.sign(
    {
      sub: String(user._id || user.id),
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
      typ: 'refresh',
      jti: crypto.randomUUID(),
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: remember ? env.JWT_REFRESH_TTL_REMEMBER : env.JWT_REFRESH_TTL, issuer: ISSUER },
  );
}

/** Short-lived token handed out after a successful `reset` OTP verification. */
function signResetToken(user) {
  return jwt.sign(
    { sub: String(user._id || user.id), tokenVersion: user.tokenVersion || 0, typ: 'reset' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_RESET_TTL, issuer: ISSUER },
  );
}

function issuePair(user, { remember = false } = {}) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user, { remember }),
  };
}

function mapJwtError(err, code) {
  if (err && err.name === 'TokenExpiredError') return new ApiError(401, 'TOKEN_EXPIRED', 'Token has expired');
  return new ApiError(401, code, 'Invalid or malformed token');
}

function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER });
    if (payload.typ && payload.typ !== 'access') throw new Error('wrong token type');
    return payload;
  } catch (err) {
    throw mapJwtError(err, 'INVALID_TOKEN');
  }
}

function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: ISSUER });
    if (payload.typ !== 'refresh') throw new Error('wrong token type');
    return payload;
  } catch (err) {
    throw mapJwtError(err, 'INVALID_REFRESH_TOKEN');
  }
}

function verifyResetToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: ISSUER });
    if (payload.typ !== 'reset') throw new Error('wrong token type');
    return payload;
  } catch (err) {
    throw mapJwtError(err, 'INVALID_RESET_TOKEN');
  }
}

/**
 * Rotate a refresh token: verify it, re-check tokenVersion against the DB user,
 * and hand back a brand-new access+refresh pair. The old refresh token stays
 * cryptographically valid until it expires, but is useless after a
 * revokeAllTokens() because tokenVersion no longer matches.
 */
async function rotateRefresh(refreshToken) {
  const { User } = require('../models');
  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Account no longer exists');
  if (!user.isActive) throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  if ((user.tokenVersion || 0) !== (payload.tokenVersion || 0)) {
    throw new ApiError(401, 'TOKEN_REVOKED', 'Session was revoked — please sign in again');
  }
  return { user, ...issuePair(user) };
}

/** Bumps tokenVersion, invalidating every access + refresh token in the wild. */
async function revokeAllTokens(userId) {
  const { User } = require('../models');
  const user = await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }, { new: true });
  return user ? user.tokenVersion : null;
}

module.exports = {
  ISSUER,
  signAccessToken,
  signRefreshToken,
  signResetToken,
  issuePair,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken,
  rotateRefresh,
  revokeAllTokens,
};
