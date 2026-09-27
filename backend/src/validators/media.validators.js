'use strict';

const { z, pagination } = require('./common.validators');

const listQuery = pagination.extend({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).optional(),
  kind: z.enum(['image', 'video', 'all']).optional(),
  category: z.string().trim().optional(),
  q: z.string().trim().optional(),
  uploadedBy: z.string().trim().optional(),
});

const uploadMeta = z.object({
  title: z.string().trim().min(1, 'Give the upload a title').max(160),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(60).optional(),
  kind: z.enum(['image', 'video']).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  durationSec: z.coerce.number().min(0).optional(),
  width: z.coerce.number().min(0).optional(),
  height: z.coerce.number().min(0).optional(),
});

const reject = z.object({
  reason: z.string().trim().min(3, 'Give the trainer a reason').max(500),
});

module.exports = { listQuery, uploadMeta, reject };
