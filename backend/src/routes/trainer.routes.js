'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/trainer.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const v = require('../validators/trainer.validators');

router.use(requireAuth, requireRole('trainer', 'admin'));

router.get('/profile', ctrl.getProfile);
router.put('/profile', validate(v.updateTrainerProfile), ctrl.updateProfile);
router.get('/availability', ctrl.getAvailability);
router.put('/availability', validate(v.availability), ctrl.updateAvailability);
router.put('/prefs', validate(v.prefs), ctrl.updatePrefs);
router.get('/dashboard', ctrl.dashboard);

module.exports = router;
