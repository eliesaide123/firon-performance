'use strict';

const router = require('express').Router();
const { health } = require('../controllers/health.controller');
const { apiLimiter } = require('../middleware/rateLimit');

// Health stays outside the rate limiter so monitoring never trips it.
router.get('/health', health);

router.use(apiLimiter);

router.use('/auth', require('./auth.routes'));
router.use('/content', require('./content.routes'));
router.use('/media', require('./media.routes'));
router.use('/videos', require('./video.routes'));
router.use('/categories', require('./category.routes'));
router.use('/exercises', require('./exercise.routes'));
router.use('/clients', require('./client.routes'));
router.use('/users', require('./user.routes'));
router.use('/profile', require('./profile.routes'));
router.use('/trainer', require('./trainer.routes'));
router.use('/plans', require('./plan.routes'));
router.use('/nutrition', require('./nutrition.routes'));
router.use('/workouts', require('./workout.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/search', require('./search.routes'));
router.use('/dashboard', require('./dashboard.routes'));

module.exports = router;
