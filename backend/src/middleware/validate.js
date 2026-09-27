'use strict';

const ApiError = require('../utils/ApiError');

/**
 * zod validation middleware.
 *   router.post('/', validate(createSchema), ctrl.create)
 *   router.get('/', validate(listQuery, 'query'), ctrl.list)
 * On success the PARSED (coerced, defaulted) value replaces req[source].
 * On failure throws 422 VALIDATION_ERROR with per-field details.
 */
function zodDetails(error) {
  return (error.issues || []).map((i) => ({
    field: i.path.join('.') || '_root',
    // `path` is kept alongside `field` so consumers that expect the raw zod
    // issue shape ([{ path, message }]) work without a shim.
    path: i.path,
    code: i.code,
    message: i.message,
  }));
}

const validate = (schema, source = 'body') => (req, res, next) => {
  if (!schema) return next();
  const result = schema.safeParse(req[source] === undefined ? {} : req[source]);
  if (!result.success) {
    const details = zodDetails(result.error);
    const first = details[0];
    return next(
      new ApiError(
        422,
        'VALIDATION_ERROR',
        first ? `${first.field}: ${first.message}` : 'Validation failed',
        details,
      ),
    );
  }
  if (source === 'query' || source === 'params') {
    // req.query/req.params can be a getter-backed object on some express versions;
    // assign field-by-field rather than replacing the object.
    Object.keys(result.data).forEach((k) => { req[source][k] = result.data[k]; });
    req[`validated${source[0].toUpperCase()}${source.slice(1)}`] = result.data;
  } else {
    req[source] = result.data;
  }
  return next();
};

module.exports = { validate, zodDetails };
