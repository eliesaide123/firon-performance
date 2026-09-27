'use strict';

const { z, objectId, pagination, boolFromQuery } = require('./common.validators');
const { PHONE_RE } = require('./auth.validators');

const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const phone = z.string().trim().regex(PHONE_RE, 'Enter a valid phone number');
const password = z.string().min(6, 'Password must be at least 6 characters').max(128);
const role = z.enum(['client', 'trainer', 'admin']);

const listQuery = pagination.extend({
  role: z.enum(['client', 'trainer', 'admin', 'all']).optional(),
  q: z.string().trim().max(120).optional(),
  isActive: boolFromQuery.optional(),
  isVerified: boolFromQuery.optional(),
  trainerId: objectId.optional(),
  sort: z.enum(['name', 'newest', 'lastLogin']).optional(),
});

/** The client sub-document an admin may patch (same fields as §4.1). */
const clientProfile = z.object({
  gender: z.enum(['Male', 'Female', 'Other']).nullish(),
  age: z.coerce.number().int().min(10).max(100).nullish(),
  heightCm: z.coerce.number().min(100, 'Height must be between 100 and 250 cm').max(250, 'Height must be between 100 and 250 cm').nullish(),
  weightKg: z.coerce.number().min(30, 'Weight must be between 30 and 300 kg').max(300, 'Weight must be between 30 and 300 kg').nullish(),
  bodyFatPct: z.coerce.number().min(1).max(70).nullish(),
  waistCm: z.coerce.number().min(30).max(250).nullish(),
  goal: z.enum(['Fat loss', 'Muscle gain', 'Strength', 'General fitness']).nullish(),
  targetWeightKg: z.coerce.number().min(30).max(300).nullish(),
  sessionsPerWeek: z.coerce.number().int().min(1).max(14).nullish(),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']).nullish(),
  membershipLabel: z.string().trim().max(60).nullish(),
  trainerId: objectId.nullish(),
  onboardingCompleted: z.boolean().optional(),
  startWeightKg: z.coerce.number().min(30).max(300).nullish(),
}).strict().partial();

/** The trainer sub-document an admin may patch. */
const trainerProfile = z.object({
  title: z.string().trim().max(120).nullish(),
  studio: z.string().trim().max(120).nullish(),
  rate: z.string().trim().max(60).nullish(),
  since: z.string().trim().max(20).nullish(),
  certs: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    verified: z.boolean().optional(),
  })).max(20).optional(),
  prefs: z.object({
    newClientRequests: z.boolean().optional(),
    sessionReminders: z.boolean().optional(),
    weeklyAdherenceReport: z.boolean().optional(),
  }).strict().optional(),
}).strict().partial();

const create = z.object({
  name: z.string().trim().min(2, 'Enter a full name').max(80),
  email,
  phone: phone.optional(),
  password,
  role,
  avatarUrl: z.string().trim().max(500).optional(),
  locale: z.string().trim().min(2).max(8).optional(),
  clientProfile: clientProfile.optional(),
  trainerProfile: trainerProfile.optional(),
}).strict();

const update = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: email.optional(),
  phone: phone.nullish(),
  avatarUrl: z.string().trim().max(500).nullish(),
  locale: z.string().trim().min(2).max(8).optional(),
  isVerified: z.boolean().optional(),
  clientProfile: clientProfile.optional(),
  trainerProfile: trainerProfile.optional(),
}).strict().refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

const setActive = z.object({ isActive: z.boolean() }).strict();

const resetPassword = z.object({ password }).strict();

module.exports = { listQuery, create, update, setActive, resetPassword, clientProfile, trainerProfile };
