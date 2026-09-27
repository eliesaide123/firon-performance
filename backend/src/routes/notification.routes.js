'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { common } = require('../validators');
const v = require('../validators/notification.validators');

router.use(requireAuth);

router.get('/', validate(v.listQuery, 'query'), ctrl.list);
router.get('/unread-count', ctrl.unreadCount);
router.patch('/read-all', ctrl.markAllRead);
router.post('/test', requireRole('admin'), validate(v.testPush), ctrl.test);
router.patch('/:id/read', validate(common.idParam, 'params'), ctrl.markRead);
router.delete('/:id', validate(common.idParam, 'params'), ctrl.remove);

module.exports = router;
