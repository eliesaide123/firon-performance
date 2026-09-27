'use strict';

/**
 * Shared Mongoose plugin (CONTRACT §4):
 *  - `_id` -> `id`
 *  - strips `__v`
 *  - strips `passwordHash` (it must NEVER leave the process)
 *  - enables virtuals on both `toJSON()` and `toObject()`
 *
 * Applied to every schema in `src/models`.
 */

const HIDDEN = ['passwordHash', 'codeHash'];

function transform(doc, ret) {
  if (ret._id !== undefined) {
    ret.id = typeof ret._id === 'object' && ret._id !== null && ret._id.toString
      ? ret._id.toString()
      : ret._id;
  }
  delete ret._id;
  delete ret.__v;
  for (const field of HIDDEN) delete ret[field];
  return ret;
}

module.exports = function toJSONPlugin(schema) {
  schema.set('toJSON', { virtuals: true, versionKey: false, transform });
  schema.set('toObject', { virtuals: true, versionKey: false, transform });
};

module.exports.transform = transform;
module.exports.HIDDEN = HIDDEN;
