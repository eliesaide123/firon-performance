'use strict';

const { z, objectId, pagination } = require('./common.validators');

const listQuery = pagination.extend({
  q: z.string().trim().optional(),
  muscleGroup: z.string().trim().optional(),
  equipment: z.string().trim().optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

const create = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  muscleGroup: z.string().trim().max(60).optional(),
  equipment: z.string().trim().max(60).optional(),
  type: z.string().trim().max(80).optional(),
  demoMediaId: objectId.nullish(),
  demoDurationLabel: z.string().trim().max(12).optional(),
  cues: z.array(z.string().trim().max(300)).optional(),
  isActive: z.boolean().optional(),
});

const update = create.partial();

module.exports = { listQuery, create, update };
