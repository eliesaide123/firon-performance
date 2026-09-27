'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/category.controller');
const { validate } = require('../middleware/validate');
const { optionalAuth, requireAuth, requireRole } = require('../middleware/auth');
const { common } = require('../validators');
const v = require('../validators/category.validators');

router.get('/', optionalAuth, validate(v.listQuery, 'query'), ctrl.list);
router.post('/', requireAuth, requireRole('admin'), validate(v.create), ctrl.create);
router.put('/:id', requireAuth, requireRole('admin'), validate(common.idParam, 'params'), validate(v.update), ctrl.update);
router.delete('/:id', requireAuth, requireRole('admin'), validate(common.idParam, 'params'), ctrl.remove);

module.exports = router;
