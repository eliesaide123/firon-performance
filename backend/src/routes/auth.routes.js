'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimit');
const v = require('../validators/auth.validators');

router.use(authLimiter);

router.post('/register', otpLimiter, validate(v.register), ctrl.register);
// NOTE: no `role` in the login body — v.login is .strict() so one is rejected.
router.post('/login', validate(v.login), ctrl.login);
router.post('/verify-otp', validate(v.verifyOtp), ctrl.verifyOtp);
router.post('/forgot-password', otpLimiter, validate(v.forgotPassword), ctrl.forgotPassword);
router.post('/reset-password', validate(v.resetPassword), ctrl.resetPassword);
router.post('/resend-otp', otpLimiter, validate(v.resendOtp), ctrl.resendOtp);
router.post('/refresh', validate(v.refresh), ctrl.refresh);

router.post('/logout', requireAuth, validate(v.logout), ctrl.logout);
router.get('/me', requireAuth, ctrl.me);
router.post('/fcm-token', requireAuth, validate(v.fcmToken), ctrl.addFcmToken);
router.delete('/fcm-token', requireAuth, validate(v.removeFcmToken), ctrl.removeFcmToken);

module.exports = router;
