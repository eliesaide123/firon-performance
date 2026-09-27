'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const toJSON = require('./plugins/toJSON');

const MAX_ATTEMPTS = 5;
const BCRYPT_COST = 10;

const otpSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    destination: { type: String, required: true, index: true },
    channel: { type: String, enum: ['email', 'sms'], default: 'email' },
    purpose: { type: String, enum: ['verify', 'reset'], required: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

otpSchema.plugin(toJSON);

// TTL: mongo reaps the doc once `expiresAt` passes (CONTRACT §4.2).
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ userId: 1, purpose: 1, consumedAt: 1 });
otpSchema.index({ destination: 1, purpose: 1, consumedAt: 1 });

otpSchema.virtual('isExpired').get(function isExpired() {
  return !!this.expiresAt && this.expiresAt.getTime() <= Date.now();
});

otpSchema.virtual('isConsumed').get(function isConsumed() {
  return !!this.consumedAt;
});

function ttlMinutes() {
  const n = Number(process.env.OTP_TTL_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

function devCode() {
  return process.env.OTP_DEV_CODE || '1234';
}

function devBypassEnabled() {
  return process.env.NODE_ENV !== 'production';
}

function generateCode() {
  // 4 digits (CONTRACT §3.6), zero-padded.
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

/**
 * Issue a fresh 4-digit OTP, invalidating any prior unconsumed OTP for the
 * same (user|destination, purpose) pair.
 * @returns {Promise<{otp: Document, code: string}>} `code` is the PLAINTEXT code —
 *          send it, log it in dev, never persist it.
 */
otpSchema.statics.issue = async function issue({ userId, destination, channel = 'email', purpose = 'verify' }) {
  if (!destination) throw new Error('Otp.issue: destination is required');

  const invalidate = { purpose, consumedAt: null };
  if (userId) invalidate.userId = userId;
  else invalidate.destination = destination;
  await this.updateMany(invalidate, { $set: { consumedAt: new Date() } });

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_COST);
  const expiresAt = new Date(Date.now() + ttlMinutes() * 60 * 1000);

  const otp = await this.create({
    userId: userId || undefined,
    destination,
    channel,
    purpose,
    codeHash,
    expiresAt,
    attempts: 0,
  });

  return { otp, code };
};

/**
 * Verify a submitted code.
 * Honours the `OTP_DEV_CODE` bypass whenever NODE_ENV !== 'production' (CONTRACT §3.6).
 * @returns {Promise<{ok:boolean, reason?:string, otp?:Document, devBypass?:boolean}>}
 *   reason ∈ 'NO_CODE' | 'NOT_FOUND' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'INVALID_CODE'
 */
otpSchema.statics.verify = async function verify({ userId, destination, purpose = 'verify', code }) {
  if (!code) return { ok: false, reason: 'NO_CODE' };

  const filter = { purpose, consumedAt: null };
  if (userId) filter.userId = userId;
  else if (destination) filter.destination = destination;
  else return { ok: false, reason: 'NOT_FOUND' };

  const otp = await this.findOne(filter).sort({ createdAt: -1 });

  // Dev bypass: `1234` always works, whether or not a doc exists.
  if (devBypassEnabled() && String(code) === String(devCode())) {
    if (otp) {
      otp.consumedAt = new Date();
      await otp.save();
    }
    return { ok: true, otp: otp || null, devBypass: true };
  }

  if (!otp) return { ok: false, reason: 'NOT_FOUND' };
  if (otp.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'EXPIRED', otp };
  if (otp.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'TOO_MANY_ATTEMPTS', otp };

  otp.attempts += 1;
  const match = await bcrypt.compare(String(code), otp.codeHash);
  if (!match) {
    await otp.save();
    const reason = otp.attempts >= MAX_ATTEMPTS ? 'TOO_MANY_ATTEMPTS' : 'INVALID_CODE';
    return { ok: false, reason, otp };
  }

  otp.consumedAt = new Date();
  await otp.save();
  return { ok: true, otp };
};

otpSchema.statics.MAX_ATTEMPTS = MAX_ATTEMPTS;
otpSchema.statics.generateCode = generateCode;
otpSchema.statics.devCode = devCode;
otpSchema.statics.ttlMinutes = ttlMinutes;

module.exports = mongoose.models.Otp || mongoose.model('Otp', otpSchema);
