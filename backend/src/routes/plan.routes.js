'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/plan.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { common } = require('../validators');
const v = require('../validators/plan.validators');

router.use(requireAuth);

const staff = requireRole('trainer', 'admin');

/* ------------------------------- training ------------------------------- */
router.get('/training/me', ctrl.myTraining);
router.get('/training', validate(v.clientIdQuery, 'query'), ctrl.listTraining);
router.post('/training', staff, validate(v.createTraining), ctrl.createTraining);

// Client progress endpoints (the controller asserts the caller IS the client).
router.patch(
  '/training/:id/day/:dayIndex/exercise/:exIndex/toggle',
  validate(v.exerciseToggleParams, 'params'),
  validate(v.toggleBody),
  ctrl.toggleExercise,
);
router.post(
  '/training/:id/day/:dayIndex/complete',
  validate(v.dayParams, 'params'),
  validate(v.completeDay),
  ctrl.completeDay,
);
router.post(
  '/training/:id/day/:dayIndex/log-exercise',
  validate(v.dayParams, 'params'),
  validate(v.logExercise),
  ctrl.logExercise,
);

router.post('/training/:id/assign', staff, validate(common.idParam, 'params'), ctrl.assignTraining);
router.put('/training/:id', staff, validate(common.idParam, 'params'), validate(v.updateTraining), ctrl.updateTraining);
router.delete('/training/:id', staff, validate(common.idParam, 'params'), ctrl.removeTraining);
router.get('/training/:id', validate(common.idParam, 'params'), ctrl.getTraining);

/* --------------------------------- diet -------------------------------- */
router.get('/diet/me', ctrl.myDiet);
router.get('/diet', validate(v.clientIdQuery, 'query'), ctrl.listDiet);
router.post('/diet/log-meal', validate(v.logMeal), ctrl.logMeal);
router.post('/diet', staff, validate(v.createDiet), ctrl.createDiet);

router.patch(
  '/diet/:id/meal/:index/toggle',
  validate(v.mealToggleParams, 'params'),
  validate(v.toggleBody),
  ctrl.toggleMeal,
);

router.post('/diet/:id/assign', staff, validate(common.idParam, 'params'), ctrl.assignDiet);
router.put('/diet/:id', staff, validate(common.idParam, 'params'), validate(v.updateDiet), ctrl.updateDiet);
router.delete('/diet/:id', staff, validate(common.idParam, 'params'), ctrl.removeDiet);
router.get('/diet/:id', validate(common.idParam, 'params'), ctrl.getDiet);

module.exports = router;
