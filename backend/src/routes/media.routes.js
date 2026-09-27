'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/media.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimit');
const { common } = require('../validators');
const v = require('../validators/media.validators');

router.use(requireAuth);

router.get('/mine', requireRole('trainer', 'admin'), ctrl.mine);
router.get('/', requireRole('trainer', 'admin'), validate(v.listQuery, 'query'), ctrl.list);

router.post(
  '/upload',
  requireRole('trainer', 'admin'),
  uploadLimiter,
  uploadSingle('file'),
  validate(v.uploadMeta),
  ctrl.upload,
);

router.patch('/:id/approve', requireRole('admin'), validate(common.idParam, 'params'), ctrl.approve);
router.patch('/:id/reject', requireRole('admin'), validate(common.idParam, 'params'), validate(v.reject), ctrl.reject);
router.delete('/:id', requireRole('admin'), validate(common.idParam, 'params'), ctrl.remove);
router.get('/:id', validate(common.idParam, 'params'), ctrl.get);

module.exports = router;
