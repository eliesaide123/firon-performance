'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/workout.controller');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const v = require('../validators/workout.validators');

router.use(requireAuth);

router.get('/logs', validate(v.logsQuery, 'query'), ctrl.logs);
router.get('/sessions', validate(v.logsQuery, 'query'), ctrl.sessions);
router.get('/summary', validate(v.summaryQuery, 'query'), ctrl.summary);

module.exports = router;
