'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Ownership rules, enforced inside controllers (not just on the route) so a
 * trainer can never read/write another trainer's client and a client can never
 * read anyone but themselves.
 *
 *   admin   -> everything
 *   trainer -> themselves + any user whose clientProfile.trainerId is them
 *   client  -> themselves only
 */
const idOf = (v) => String((v && (v._id || v.id)) || v || '');

function isSelf(actor, targetId) {
  return idOf(actor) === idOf(targetId);
}

/** True when `client` (a User doc/lean object) belongs to this trainer. */
function ownsClient(trainer, client) {
  if (!client) return false;
  const trainerId = client.clientProfile && client.clientProfile.trainerId;
  return idOf(trainerId) === idOf(trainer);
}

/**
 * Loads a client User and asserts the actor may touch it.
 * Returns the User document.
 */
async function loadClientFor(actor, clientId) {
  const { User } = require('../models');
  if (!clientId) throw new ApiError(400, 'BAD_REQUEST', 'clientId is required');

  const client = await User.findById(clientId);
  if (!client) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'That client does not exist');

  if (actor.role === 'admin') return client;
  if (isSelf(actor, client._id)) return client;
  if (actor.role === 'trainer' && ownsClient(actor, client)) return client;

  throw new ApiError(403, 'FORBIDDEN', 'That client is not on your roster');
}

/**
 * Asserts the actor may read/write a plan document (training or diet).
 * `mode` is 'read' | 'write'. Clients may read their own plan but only
 * trainers/admins may write it (check-off endpoints call assertClientOfPlan).
 */
function assertPlanAccess(actor, plan, mode = 'read') {
  if (!plan) throw new ApiError(404, 'PLAN_NOT_FOUND', 'That plan does not exist');
  if (actor.role === 'admin') return plan;

  const isOwnerClient = idOf(plan.clientId) === idOf(actor);
  const isOwnerTrainer = idOf(plan.trainerId) === idOf(actor);

  if (actor.role === 'trainer') {
    if (!isOwnerTrainer) throw new ApiError(403, 'FORBIDDEN', 'That plan belongs to another coach');
    return plan;
  }

  // client
  if (!isOwnerClient) throw new ApiError(403, 'FORBIDDEN', 'That plan is not yours');
  if (mode === 'write') {
    // Clients may only mutate progress fields, via the dedicated endpoints.
    throw new ApiError(403, 'FORBIDDEN', 'Only your coach can edit the plan itself');
  }
  return plan;
}

/** For client-progress endpoints: the caller must BE the plan's client (admins allowed). */
function assertIsPlanClient(actor, plan) {
  if (!plan) throw new ApiError(404, 'PLAN_NOT_FOUND', 'That plan does not exist');
  if (actor.role === 'admin') return plan;
  if (idOf(plan.clientId) !== idOf(actor)) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the assigned client can log progress on this plan');
  }
  return plan;
}

/** The set of client ids a trainer is allowed to see. */
async function rosterIds(trainer) {
  const { User } = require('../models');
  const rows = await User.find({ role: 'client', 'clientProfile.trainerId': idOf(trainer) })
    .select('_id')
    .lean();
  return rows.map((r) => String(r._id));
}

module.exports = { idOf, isSelf, ownsClient, loadClientFor, assertPlanAccess, assertIsPlanClient, rosterIds };
