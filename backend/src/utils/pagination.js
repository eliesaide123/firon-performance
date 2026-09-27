'use strict';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

/** Reads ?page/?limit off a request and returns { page, limit, skip }. */
function parsePagination(query = {}, { defaultLimit = DEFAULT_LIMIT } = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
}

/** Builds the paginated `meta` block: { page, limit, total, pages }. */
function pageMeta({ page, limit }, total) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { parsePagination, pageMeta, DEFAULT_LIMIT, MAX_LIMIT };
