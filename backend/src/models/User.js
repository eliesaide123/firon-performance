'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const toJSON = require('./plugins/toJSON');

const BCRYPT_COST = 10;
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fcmTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], default: 'android' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const certSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    verified: { type: Boolean, default: false },
  },
  { _id: false }
);

const availabilitySchema = new mongoose.Schema(
  {
    day: { type: String, enum: DAYS, required: true },
    off: { type: Boolean, default: false },
    from: { type: String, default: '09:00' },
    to: { type: String, default: '17:00' },
  },
  { _id: false }
);

const clientProfileSchema = new mongoose.Schema(
  {
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    age: { type: Number },
    heightCm: { type: Number },
    weightKg: { type: Number },
    bodyFatPct: { type: Number },
    waistCm: { type: Number },
    goal: { type: String, enum: ['Fat loss', 'Muscle gain', 'Strength', 'General fitness'] },
    targetWeightKg: { type: Number },
    sessionsPerWeek: { type: Number },
    level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'] },
    membershipLabel: { type: String, default: 'Premium plan' },
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    onboardingCompleted: { type: Boolean, default: false },
    startWeightKg: { type: Number },
  },
  { _id: false }
);

const trainerProfileSchema = new mongoose.Schema(
  {
    title: { type: String },
    studio: { type: String },
    rate: { type: String },
    since: { type: String },
    certs: { type: [certSchema], default: [] },
    availability: { type: [availabilitySchema], default: [] }, // 7 entries, Mon..Sun
    prefs: {
      newClientRequests: { type: Boolean, default: true },
      sessionReminders: { type: Boolean, default: true },
      weeklyAdherenceReport: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true, index: true, sparse: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['client', 'trainer', 'admin'],
      default: 'client',
      index: true,
    },
    avatarUrl: { type: String },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    locale: { type: String, default: 'en' },
    fcmTokens: { type: [fcmTokenSchema], default: [] },
    lastLoginAt: { type: Date },
    clientProfile: { type: clientProfileSchema, default: () => ({}) },
    trainerProfile: { type: trainerProfileSchema, default: () => ({}) },
  },
  { timestamps: true }
);

userSchema.plugin(toJSON);

/* ------------------------------- virtuals ------------------------------- */

userSchema.virtual('initials').get(function initials() {
  if (!this.name) return '';
  return this.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] || '').toUpperCase())
    .join('');
});

userSchema.virtual('bmi').get(function bmi() {
  const h = this.clientProfile && this.clientProfile.heightCm;
  const w = this.clientProfile && this.clientProfile.weightKg;
  if (!h || !w) return null;
  return Number((w / Math.pow(h / 100, 2)).toFixed(1));
});

/* -------------------------- password handling --------------------------- */

/** Explicitly set a plaintext password — hashed by the pre('save') hook. */
userSchema.methods.setPassword = function setPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  this.passwordHash = plain;
  this.$locals.passwordIsPlain = true;
  return this;
};

/** True when the stored value already looks like a bcrypt hash (never re-hash). */
userSchema.statics.isHashed = (value) => typeof value === 'string' && BCRYPT_RE.test(value);

userSchema.pre('save', async function hashPassword(next) {
  try {
    if (!this.isModified('passwordHash')) return next();
    const current = this.passwordHash;
    if (!current) return next();
    // Guard against double-hashing: only hash plaintext.
    if (!this.$locals.passwordIsPlain && BCRYPT_RE.test(current)) return next();
    this.passwordHash = await bcrypt.hash(current, BCRYPT_COST);
    this.$locals.passwordIsPlain = false;
    return next();
  } catch (err) {
    return next(err);
  }
});

/**
 * bcrypt compare. Works even when the doc was loaded without `+passwordHash`
 * (it re-reads just that field).
 */
userSchema.methods.comparePassword = async function comparePassword(plain) {
  if (!plain) return false;
  let hash = this.passwordHash;
  if (!hash) {
    const fresh = await this.constructor
      .findById(this._id)
      .select('+passwordHash')
      .lean();
    hash = fresh && fresh.passwordHash;
  }
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
};

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_COST);

userSchema.statics.BCRYPT_COST = BCRYPT_COST;
userSchema.statics.DAYS = DAYS;

/* -------------------------------- indexes ------------------------------- */

userSchema.index({ role: 1, 'clientProfile.trainerId': 1 });
userSchema.index({ name: 'text', email: 'text' });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
