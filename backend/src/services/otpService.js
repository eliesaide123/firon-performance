'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { env } = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const mailService = require('./mailService');
const smsService = require('./smsService');

/**
 * OTP orchestration (CONTRACT §3.6).
 *
 * Prefers the `Otp` model statics owned by the DATABASE agent (`Otp.issue` /
 * `Otp.verify`). Because those statics' exact signature is not pinned by the
 * contract, this module adapts to the common shapes and falls back to a local
 * bcrypt implementation against the documented schema (§4.2) if a static is
 * missing — so auth can never be bricked by a signature mismatch.
 *
 * In NODE_ENV !== 'production' the generated code is logged AND
 * OTP_DEV_CODE (default '1234') is always accepted.
 */
const CODE_LENGTH = 4;

/** Cryptographically-random 4-digit code, zero padded. */
function generateCode() {
  const n = crypto.randomInt(0, 10 ** CODE_LENGTH);
  return String(n).padStart(CODE_LENGTH, '0');
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
const normalisePhone = (v) => String(v || '').replace(/[^\d+]/g, '');

/** Guesses the delivery channel from the destination when none was given. */
function resolveChannel(destination, channel) {
  if (channel === 'email' || channel === 'sms') return channel;
  return isEmail(destination) ? 'email' : 'sms';
}

/** Picks the destination for a user + channel. */
function destinationFor(user, channel) {
  if (channel === 'sms') return user.phone || user.email;
  return user.email || user.phone;
}

/** Mask for the response so we never echo a full address back. */
function maskDestination(dest) {
  const s = String(dest || '');
  if (isEmail(s)) {
    const [local, domain] = s.split('@');
    const head = local.slice(0, 2);
    return `${head}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  }
  return s.length > 4 ? `${'*'.repeat(s.length - 4)}${s.slice(-4)}` : s;
}

async function deliver(channel, destination, code, purpose) {
  if (channel === 'sms') return smsService.sendOtp(destination, code, purpose);
  return mailService.sendOtp(destination, code, purpose);
}

/**
 * Creates (or refreshes) an OTP for a user and delivers it.
 * Returns { destination, maskedDestination, channel, code (dev only), expiresAt }.
 */
async function issue({ user, purpose = 'verify', channel, destination }) {
  const { Otp } = require('../models');
  const ch = resolveChannel(destination || destinationFor(user, channel), channel);
  const dest = destination || destinationFor(user, ch);
  if (!dest) throw new ApiError(400, 'NO_DESTINATION', 'No email or phone on file to send a code to');

  const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000);
  let code;

  if (typeof Otp.issue === 'function') {
    // Model static owns code generation + hashing.
    const res = await Otp.issue({
      userId: user._id,
      destination: dest,
      channel: ch,
      purpose,
      ttlMinutes: env.OTP_TTL_MINUTES,
    });
    code = (res && (res.code || res.plainCode || res.rawCode))
      || (typeof res === 'string' ? res : null);
    if (!code) {
      // Static hid the code (hash only). Re-issue locally so we can deliver it.
      logger.debug('[otp] Otp.issue did not return a plaintext code — falling back to local issue');
      code = await localIssue({ user, dest, ch, purpose, expiresAt });
    }
  } else {
    code = await localIssue({ user, dest, ch, purpose, expiresAt });
  }

  if (env.isDev) {
    logger.info(
      { userId: String(user._id), purpose, channel: ch, destination: dest, code },
      `[otp] DEV CODE for ${dest} = ${code} (purpose ${purpose}); '${env.OTP_DEV_CODE}' is also accepted`,
    );
  }

  await deliver(ch, dest, code, purpose);

  return {
    destination: dest,
    maskedDestination: maskDestination(dest),
    channel: ch,
    expiresAt,
    // Only ever leaked outside production, and only to make the demo usable.
    devCode: env.isDev ? code : undefined,
  };
}

/** Fallback issue path written directly against the documented Otp schema (§4.2). */
async function localIssue({ user, dest, ch, purpose, expiresAt }) {
  const { Otp } = require('../models');
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  // Invalidate any outstanding code for the same user+purpose.
  await Otp.updateMany(
    { userId: user._id, purpose, consumedAt: null },
    { consumedAt: new Date() },
  ).catch(() => {});
  await Otp.create({
    userId: user._id,
    destination: dest,
    channel: ch,
    purpose,
    codeHash,
    attempts: 0,
    expiresAt,
  });
  return code;
}

/**
 * Verifies a code for a user + purpose. Throws ApiError on failure.
 * Accepts OTP_DEV_CODE outside production.
 */
async function verify({ user, code, purpose = 'verify', destination }) {
  const { Otp } = require('../models');
  const submitted = String(code || '').trim();
  if (!/^\d{4}$/.test(submitted)) {
    throw new ApiError(400, 'INVALID_OTP', 'Enter the 4-digit code we sent you');
  }

  if (env.isDev && submitted === String(env.OTP_DEV_CODE)) {
    logger.warn({ userId: String(user._id), purpose }, '[otp] accepted OTP_DEV_CODE');
    await Otp.updateMany(
      { userId: user._id, purpose, consumedAt: null },
      { consumedAt: new Date() },
    ).catch(() => {});
    return { ok: true, dev: true };
  }

  if (typeof Otp.verify === 'function') {
    const res = await Otp.verify({
      userId: user._id,
      code: submitted,
      purpose,
      destination,
    });
    const okFlag = res === true || (res && (res.ok === true || res.valid === true || res._id));
    if (!okFlag) throw reasonToError(res && res.reason);
    return { ok: true, devBypass: !!(res && res.devBypass) };
  }

  return localVerify({ user, code: submitted, purpose });
}

async function localVerify({ user, code, purpose }) {
  const { Otp } = require('../models');
  const otp = await Otp.findOne({
    userId: user._id,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otp) throw new ApiError(400, 'OTP_EXPIRED', 'That code has expired — request a new one');
  if ((otp.attempts || 0) >= env.OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Too many attempts — request a new code');
  }

  const match = await bcrypt.compare(code, otp.codeHash || '');
  if (!match) {
    otp.attempts = (otp.attempts || 0) + 1;
    await otp.save();
    throw new ApiError(400, 'INVALID_OTP', 'That code is incorrect');
  }

  otp.consumedAt = new Date();
  await otp.save();
  return { ok: true };
}

/** Maps the Otp model's `reason` codes onto API error codes. */
function reasonToError(reason) {
  switch (reason) {
    case 'EXPIRED':
      return new ApiError(400, 'OTP_EXPIRED', 'That code has expired — request a new one');
    case 'TOO_MANY_ATTEMPTS':
      return new ApiError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Too many attempts — request a new code');
    case 'NOT_FOUND':
      return new ApiError(400, 'OTP_NOT_FOUND', 'No active code for that account — request a new one');
    case 'NO_CODE':
      return new ApiError(400, 'INVALID_OTP', 'Enter the 4-digit code we sent you');
    default:
      return new ApiError(400, 'INVALID_OTP', 'That code is incorrect');
  }
}

module.exports = { issue, verify, generateCode, maskDestination, resolveChannel, isEmail, normalisePhone };
