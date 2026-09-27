'use strict';

/**
 * Model barrel (CONTRACT §4). Prefer `const { User } = require('../models')`
 * over deep-requiring individual files so every model is registered with
 * mongoose before any `populate()` runs.
 */

module.exports = {
  User: require('./User'),
  Otp: require('./Otp'),
  Content: require('./Content'),
  MediaAsset: require('./MediaAsset'),
  Category: require('./Category'),
  Video: require('./Video'),
  VideoProgress: require('./VideoProgress'),
  Exercise: require('./Exercise'),
  TrainingPlan: require('./TrainingPlan'),
  DietPlan: require('./DietPlan'),
  MealLog: require('./MealLog'),
  WorkoutLog: require('./WorkoutLog'),
  SessionRecord: require('./SessionRecord'),
  Notification: require('./Notification'),
  AuditLog: require('./AuditLog'),
};
