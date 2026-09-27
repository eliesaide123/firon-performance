'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/profile.controller');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const v = require('../validators/profile.validators');

router.use(requireAuth);

router.get('/', ctrl.get);
router.put('/', validate(v.updateProfile), ctrl.update);
router.put('/client-details', validate(v.clientDetails), ctrl.updateClientDetails);
router.put('/password', validate(v.changePassword), ctrl.changePassword);
router.get('/progress', ctrl.progress);

module.exports = router;
