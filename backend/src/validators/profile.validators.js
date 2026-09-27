'use strict';

const { z } = require('./common.validators');
const { PHONE_RE } = require('./auth.validators');

const updateProfile = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').optional(),
  phone: z.string().trim().regex(PHONE_RE, 'Enter a valid phone number').optional(),
  avatarUrl: z.string().trim().max(500).optional(),
  locale: z.string().trim().min(2).max(8).optional(),
}).strict();

/**
 * The onboarding / "My details" payload.
 * Mirrors the prototype's saveMyDetails() rule exactly:
 * height 100–250 cm, weight 30–300 kg; everything else optional.
 */
const clientDetails = z.object({
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  age: z.coerce.number().int().min(10, 'Age looks wrong').max(100, 'Age looks wrong').optional(),
  heightCm: z.coerce.number().min(100, 'Height must be between 100 and 250 cm').max(250, 'Height must be between 100 and 250 cm'),
  weightKg: z.coerce.number().min(30, 'Weight must be between 30 and 300 kg').max(300, 'Weight must be between 30 and 300 kg'),
  bodyFatPct: z.coerce.number().min(1).max(70).nullish(),
  waistCm: z.coerce.number().min(30).max(250).nullish(),
  goal: z.enum(['Fat loss', 'Muscle gain', 'Strength', 'General fitness']).optional(),
  targetWeightKg: z.coerce.number().min(30).max(300).nullish(),
  sessionsPerWeek: z.coerce.number().int().min(1).max(14).optional(),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
}).strict();

const changePassword = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
}).strict();

module.exports = { updateProfile, clientDetails, changePassword };
