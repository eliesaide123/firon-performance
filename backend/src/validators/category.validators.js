'use strict';

const { z } = require('./common.validators');

const listQuery = z.object({
  kind: z.enum(['video', 'exercise', 'all']).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

const create = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  slug: z.string().trim().max(60).optional(),
  order: z.coerce.number().int().optional(),
  icon: z.string().trim().max(60).optional(),
  kind: z.enum(['video', 'exercise']).optional(),
  isActive: z.boolean().optional(),
});

const update = create.partial();

module.exports = { listQuery, create, update };
