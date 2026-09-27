'use strict';

const { z, objectId } = require('./common.validators');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s()-]{6,20}$/;

const password = z.string().min(6, 'Password must be at least 6 characters').max(128);
const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const phone = z.string().trim().regex(PHONE_RE, 'Enter a valid phone number');
const code = z.string().trim().regex(/^\d{4}$/, 'Enter the 4-digit code');
const channel = z.enum(['email', 'sms']);
const purpose = z.enum(['verify', 'reset']);

/** identifier = email OR phone (the login screen never asks which). */
const identifier = z
  .string()
  .trim()
  .min(3, 'Enter a valid email or phone number')
  .refine((v) => EMAIL_RE.test(v) || PHONE_RE.test(v), 'Enter a valid email or phone number');

const register = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  email,
  phone: phone.optional(),
  password,
  locale: z.string().trim().min(2).max(8).optional(),
}).strict();

/**
 * CONTRACT §3.1/§3.2: the login request carries NO role.
 * `.strict()` makes a smuggled `role` a hard 422 rather than something the
 * server might accidentally honour.
 */
const login = z.object({
  identifier,
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional().default(false),
}).strict();

const verifyOtp = z.object({
  userId: objectId.optional(),
  destination: z.string().trim().min(3).optional(),
  code,
  purpose: purpose.default('verify'),
}).refine((v) => v.userId || v.destination, {
  message: 'Provide userId or destination',
  path: ['userId'],
});

const forgotPassword = z.object({
  identifier,
  channel: channel.default('email'),
}).strict();

const resetPassword = z.object({
  resetToken: z.string().min(10, 'Reset token is required'),
  password,
}).strict();

const resendOtp = z.object({
  userId: objectId.optional(),
  destination: z.string().trim().min(3).optional(),
  purpose: purpose.default('verify'),
  channel: channel.optional(),
}).refine((v) => v.userId || v.destination, {
  message: 'Provide userId or destination',
  path: ['userId'],
});

const refresh = z.object({
  refreshToken: z.string().min(10, 'refreshToken is required'),
}).strict();

const logout = z.object({
  refreshToken: z.string().optional(),
  fcmToken: z.string().optional(),
  token: z.string().optional(),
  allDevices: z.boolean().optional().default(false),
});

const fcmToken = z.object({
  token: z.string().trim().min(10, 'A device token is required'),
  platform: z.enum(['ios', 'android', 'web']).default('android'),
}).strict();

const removeFcmToken = z.object({
  token: z.string().trim().min(10, 'A device token is required'),
}).strict();

module.exports = {
  register,
  login,
  verifyOtp,
  forgotPassword,
  resetPassword,
  resendOtp,
  refresh,
  logout,
  fcmToken,
  removeFcmToken,
  EMAIL_RE,
  PHONE_RE,
};
