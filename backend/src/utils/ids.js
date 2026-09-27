'use strict';

const mongoose = require('mongoose');
const ApiError = require('./ApiError');

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v || ''))
  && String(new mongoose.Types.ObjectId(String(v))) === String(v);

/** Throws a 400 instead of letting mongoose blow up with a CastError. */
function assertObjectId(value, field = 'id') {
  if (!isObjectId(value)) throw new ApiError(400, 'INVALID_ID', `'${field}' is not a valid id`);
  return String(value);
}

const sameId = (a, b) => !!a && !!b && String(a._id || a) === String(b._id || b);

module.exports = { isObjectId, assertObjectId, sameId };
