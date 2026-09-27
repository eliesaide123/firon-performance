'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/video.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');
const { common } = require('../validators');
const v = require('../validators/video.validators');

router.get('/suggested', requireAuth, ctrl.suggested);
router.get('/continue-watching', requireAuth, ctrl.continueWatching);
router.get('/', optionalAuth, validate(v.listQuery, 'query'), ctrl.list);

router.post('/', requireAuth, requireRole('admin'), validate(v.create), ctrl.create);
router.put('/:id', requireAuth, requireRole('admin'), validate(common.idParam, 'params'), validate(v.update), ctrl.update);
router.delete('/:id', requireAuth, requireRole('admin'), validate(common.idParam, 'params'), ctrl.remove);

router.post('/:id/progress', requireAuth, validate(common.idParam, 'params'), validate(v.progress), ctrl.saveProgress);
router.post('/:id/favorite', requireAuth, validate(common.idParam, 'params'), ctrl.toggleFavorite);
router.get('/:id', optionalAuth, validate(common.idParam, 'params'), ctrl.get);

module.exports = router;
