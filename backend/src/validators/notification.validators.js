'use strict';

const { z, pagination, boolFromQuery, objectId } = require('./common.validators');

const listQuery = pagination.extend({
  unread: boolFromQuery.optional(),
  type: z.string().trim().optional(),
});

const testPush = z.object({
  userId: objectId.optional(),
  title: z.string().trim().max(160).optional(),
  body: z.string().trim().max(500).optional(),
  type: z.string().trim().max(40).optional(),
  // Accepted top-level so the CMS can set it directly; the controller also honours data.deepLink.
  deepLink: z.string().trim().max(200).optional(),
  data: z.record(z.any()).optional(),
});

module.exports = { listQuery, testPush };
