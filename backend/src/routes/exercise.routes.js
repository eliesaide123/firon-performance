'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/exercise.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { common } = require('../validators');
const v = require('../validators/exercise.validators');

router.use(requireAuth);

router.get('/', validate(v.listQuery, 'query'), ctrl.list);
router.get('/:id', validate(common.idParam, 'params'), ctrl.get);
router.post('/', requireRole('trainer', 'admin'), validate(v.create), ctrl.create);
router.put('/:id', requireRole('trainer', 'admin'), validate(common.idParam, 'params'), validate(v.update), ctrl.update);
router.delete('/:id', requireRole('trainer', 'admin'), validate(common.idParam, 'params'), ctrl.remove);

module.exports = router;
