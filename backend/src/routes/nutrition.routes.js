'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/nutrition.controller');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { common } = require('../validators');
const v = require('../validators/nutrition.validators');

router.use(requireAuth);

router.get('/today', validate(v.todayQuery, 'query'), ctrl.today);
router.get('/history', validate(v.historyQuery, 'query'), ctrl.history);
router.post('/log', validate(v.logMeal), ctrl.log);
router.patch('/log/:id/toggle', validate(common.idParam, 'params'), ctrl.toggleLog);

module.exports = router;
