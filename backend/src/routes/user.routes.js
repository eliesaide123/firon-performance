'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { common } = require('../validators');
const v = require('../validators/user.validators');

// The entire /api/users surface is admin-only (CMS user administration).
router.use(requireAuth, requireRole('admin'));

router.get('/', validate(v.listQuery, 'query'), ctrl.list);
router.post('/', validate(v.create), ctrl.create);

router.patch('/:id/active', validate(common.idParam, 'params'), validate(v.setActive), ctrl.setActive);
router.post('/:id/reset-password', validate(common.idParam, 'params'), validate(v.resetPassword), ctrl.resetPassword);

router.get('/:id', validate(common.idParam, 'params'), ctrl.get);
router.put('/:id', validate(common.idParam, 'params'), validate(v.update), ctrl.update);
router.delete('/:id', validate(common.idParam, 'params'), ctrl.remove);

module.exports = router;
