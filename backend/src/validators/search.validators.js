'use strict';

const { z } = require('./common.validators');

const searchQuery = z.object({
  q: z.string().trim().max(120).optional().default(''),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

module.exports = { searchQuery };
