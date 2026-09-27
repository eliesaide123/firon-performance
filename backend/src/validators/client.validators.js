'use strict';

const { z, objectId, pagination } = require('./common.validators');

const listQuery = pagination.extend({
  q: z.string().trim().optional(),
  status: z.enum(['ok', 'warn', 'new', 'all']).optional(),
  trainerId: objectId.optional(),
});

const assignTrainer = z.object({
  trainerId: objectId,
}).strict();

module.exports = { listQuery, assignTrainer };
