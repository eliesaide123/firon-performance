'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/content.controller');
const { validate } = require('../middleware/validate');
const { optionalAuth, requireAuth, requireRole } = require('../middleware/auth');
const { common } = require('../validators');
const v = require('../validators/content.validators');

// Public reads: the mobile app fetches content before anyone is signed in.
router.get('/', optionalAuth, validate(v.listQuery, 'query'), ctrl.list);
router.get('/groups', optionalAuth, ctrl.groups);

// Admin writes. `/bulk` must be declared before `/:key`-shaped routes.
router.patch('/bulk', requireAuth, requireRole('admin'), validate(v.bulk), ctrl.bulkUpdate);
router.post('/seed-defaults', requireAuth, requireRole('admin'), ctrl.seedDefaults);
router.post('/', requireAuth, requireRole('admin'), validate(v.create), ctrl.create);
router.put('/:id', requireAuth, requireRole('admin'), validate(common.idParam, 'params'), validate(v.update), ctrl.update);
router.delete('/:id', requireAuth, requireRole('admin'), validate(common.idParam, 'params'), ctrl.remove);

// Keep the catch-all key lookup last so it cannot shadow the routes above.
router.get('/:key', optionalAuth, ctrl.getByKey);

module.exports = router;
