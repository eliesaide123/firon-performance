'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/client.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { common } = require('../validators');
const v = require('../validators/client.validators');

// The whole roster surface is trainer/admin only; the controllers additionally
// verify that the specific client belongs to the calling trainer.
router.use(requireAuth, requireRole('trainer', 'admin'));

router.get('/stats', ctrl.stats);
router.get('/', validate(v.listQuery, 'query'), ctrl.roster);
router.post('/:id/assign-trainer', requireRole('admin'), validate(common.idParam, 'params'), validate(v.assignTrainer), ctrl.assignTrainer);
router.get('/:id', validate(common.idParam, 'params'), ctrl.detail);

module.exports = router;
