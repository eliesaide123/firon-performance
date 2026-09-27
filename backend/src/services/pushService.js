'use strict';

const fs = require('fs');
const admin = require('firebase-admin');
const { env } = require('../config');
const logger = require('../utils/logger');

/**
 * Firebase Cloud Messaging wrapper (CONTRACT §7).
 *
 * Initialises LAZILY from FIREBASE_SERVICE_ACCOUNT_PATH. If that file is absent (the normal local
 * dev case) we log ONE warning and every method becomes a no-op — the server still boots and
 * every other feature, in-app socket notifications included, keeps working. Drop a real service
 * account JSON at the configured path and restart to switch it on; no code change needed.
 *
 * Nothing in here ever throws. Push is best-effort background delivery: a failed send must never
 * turn into a failed HTTP request for the user who triggered it.
 */
let state = 'uninitialised'; // 'uninitialised' | 'ready' | 'disabled'
let app = null;
let projectId = null;

/**
 * Must match, exactly:
 *   mobile/src/push/channels.ts                                    DEFAULT_CHANNEL_ID
 *   mobile/android/app/src/main/res/values/strings.xml             default_notification_channel_id
 * An unknown channel id makes Android 8+ drop the notification SILENTLY.
 */
const DEFAULT_CHANNEL_ID = 'firon-default';

/** sendEachForMulticast refuses more than 500 tokens in one call. */
const MAX_TOKENS_PER_CALL = 500;

function init() {
  if (state !== 'uninitialised') return state === 'ready';

  if (!fs.existsSync(env.FIREBASE_SERVICE_ACCOUNT_PATH)) {
    state = 'disabled';
    logger.warn(
      { path: env.FIREBASE_SERVICE_ACCOUNT_PATH },
      '[push] no Firebase service account found — push notifications are DISABLED '
      + '(in-app socket notifications still work). See docs/FIREBASE.md to enable.',
    );
    return false;
  }

  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const serviceAccount = require(env.FIREBASE_SERVICE_ACCOUNT_PATH);
    app = admin.apps.length
      ? admin.app()
      : admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    projectId = serviceAccount.project_id || null;
    state = 'ready';
    logger.info({ projectId }, '[push] Firebase Admin initialised');
    return true;
  } catch (err) {
    state = 'disabled';
    logger.warn({ err: err.message }, '[push] Firebase Admin failed to initialise — push DISABLED');
    return false;
  }
}

const isEnabled = () => init();

/** For /api/notifications/test and docs/FIREBASE.md troubleshooting. Never throws. */
function status() {
  const enabled = init();
  return {
    enabled,
    state,
    projectId,
    serviceAccountPath: env.FIREBASE_SERVICE_ACCOUNT_PATH,
    defaultChannelId: DEFAULT_CHANNEL_ID,
  };
}

/**
 * Error codes that mean "this specific token is dead" — prune it.
 *
 * `messaging/invalid-argument` is in here deliberately but it is the blunt one: FCM also uses it
 * for a malformed MESSAGE. We only ever reach the per-token branch from sendEachForMulticast,
 * where the message was accepted and the token was not, so pruning is right — but it is logged
 * loudly enough to notice if a payload bug ever starts shredding good tokens.
 */
const PRUNE_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * FCM requires `data` to be string -> string. A number, boolean, null or object anywhere in there
 * makes the whole send throw `messaging/invalid-argument`, so coerce everything.
 * Strings pass through untouched (JSON.stringify would wrap them in quotes).
 */
function stringifyData(data = {}) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === 'string') out[k] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
    else out[k] = JSON.stringify(v);
  });
  return out;
}

/** A badge must be a non-negative integer or APNs rejects the payload. */
function normaliseBadge(badge) {
  return Number.isInteger(badge) && badge >= 0 ? badge : undefined;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Build the multicast message.
 *
 * Platform notes that matter:
 *  * android.priority 'high'          — without it a doze-mode device may hold the push for
 *                                       minutes. This is the setting people miss when "push works
 *                                       but arrives late".
 *  * android.notification.channelId   — see DEFAULT_CHANNEL_ID above.
 *  * apns-push-type / apns-priority   — required headers on modern APNs. 'alert' + '10' for a
 *                                       user-visible push; a data-only push must be
 *                                       'background' + '5' or Apple may throttle or reject it.
 *  * apns content-available           — wakes the app's background handler on iOS.
 */
function buildMessage(tokens, msg = {}) {
  const data = stringifyData({
    ...msg.data,
    // §7: every push carries these three so a tap can navigate. Kept here as a backstop in case a
    // caller builds a message without going through notificationService.
    type: (msg.data && msg.data.type) || msg.type || 'generic',
  });
  const badge = normaliseBadge(msg.badge);
  const dataOnly = msg.dataOnly === true;
  const channelId = msg.channelId || DEFAULT_CHANNEL_ID;

  const message = {
    tokens,
    data,
    android: {
      priority: 'high',
      ...(dataOnly
        ? {}
        : {
          notification: {
            channelId,
            sound: 'default',
            defaultVibrateTimings: true,
            // Matches mobile/android/.../res/drawable/ic_notification.xml + colors.xml.
            icon: 'ic_notification',
            color: '#c7ff3f',
          },
        }),
    },
    apns: {
      headers: {
        'apns-push-type': dataOnly ? 'background' : 'alert',
        'apns-priority': dataOnly ? '5' : '10',
      },
      payload: {
        aps: {
          ...(dataOnly ? {} : { sound: 'default' }),
          ...(badge === undefined ? {} : { badge }),
          'content-available': 1,
        },
      },
    },
  };

  if (!dataOnly) {
    message.notification = {
      title: msg.title || 'Firon Performance',
      body: msg.body || '',
    };
  }

  return message;
}

/**
 * Send to raw tokens. Returns { sent, failed, invalidTokens }.
 *
 * `opts.dryRun` asks FCM to validate the message and the tokens without delivering anything —
 * that is how you prove the service account and the payload are good with no device in hand.
 */
async function sendToTokens(tokens, msg = {}, opts = {}) {
  const list = [...new Set((Array.isArray(tokens) ? tokens : [tokens]).filter(Boolean))];
  if (!list.length) return { sent: 0, failed: 0, invalidTokens: [] };
  if (!init()) return { sent: 0, failed: 0, invalidTokens: [], skipped: true };

  const dryRun = opts.dryRun === true;
  const totals = { sent: 0, failed: 0, invalidTokens: [], dryRun };

  for (const batch of chunk(list, MAX_TOKENS_PER_CALL)) {
    const message = buildMessage(batch, msg);
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await admin.messaging().sendEachForMulticast(message, dryRun);
      res.responses.forEach((r, i) => {
        if (r.success) return;
        const code = r.error && r.error.code;
        if (PRUNE_CODES.has(code)) {
          totals.invalidTokens.push(batch[i]);
          logger.debug({ code }, '[push] token is dead — will prune');
        } else {
          logger.warn({ code, err: r.error && r.error.message }, '[push] delivery failed');
        }
      });
      totals.sent += res.successCount;
      totals.failed += res.failureCount;
    } catch (err) {
      // A throw here is a message-level problem (bad credentials, malformed payload), not a token
      // one — never prune on this path.
      logger.warn({ err: err.message, code: err.code }, '[push] sendEachForMulticast threw');
      totals.failed += batch.length;
      totals.error = err.code || err.message;
    }
  }

  return totals;
}

/** Remove tokens FCM told us are dead, so the next send is not wasted on them. */
async function pruneTokens(userId, invalidTokens) {
  if (!invalidTokens || !invalidTokens.length) return;
  const { User } = require('../models');
  await User.updateOne(
    { _id: userId },
    { $pull: { fcmTokens: { token: { $in: invalidTokens } } } },
  ).catch((err) => logger.warn({ err: err.message }, '[push] token prune failed'));
  logger.info({ userId, pruned: invalidTokens.length }, '[push] pruned dead FCM tokens');
}

/**
 * Send to every device registered for a user, pruning dead tokens from the User doc afterwards.
 * Never throws.
 */
async function sendToUser(userId, msg = {}, opts = {}) {
  if (!userId) return { sent: 0, failed: 0 };
  if (!init()) return { sent: 0, failed: 0, skipped: true };

  const { User } = require('../models');
  const user = await User.findById(userId).select('fcmTokens').lean();
  const tokens = ((user && user.fcmTokens) || []).map((t) => t.token).filter(Boolean);
  if (!tokens.length) return { sent: 0, failed: 0, noTokens: true };

  const result = await sendToTokens(tokens, msg, opts);
  if (!opts.dryRun) await pruneTokens(userId, result.invalidTokens);
  return result;
}

async function sendToUsers(userIds = [], msg = {}, opts = {}) {
  const results = await Promise.all(userIds.map((id) => sendToUser(id, msg, opts)));
  return results.reduce(
    (acc, r) => ({ sent: acc.sent + (r.sent || 0), failed: acc.failed + (r.failed || 0) }),
    { sent: 0, failed: 0 },
  );
}

/**
 * Validate the whole setup WITHOUT delivering anything.
 *
 * With a real token: proves the service account can authenticate to the project and that the
 * token belongs to it — no device has to be watched, nothing appears in any tray.
 * With no token: reports whether Firebase Admin initialised at all, which is the first question
 * to answer when "push does nothing".
 *
 * Returns a plain object, never throws. See docs/FIREBASE.md.
 */
async function sendDryRun(tokens = [], msg = {}) {
  const info = status();
  if (!info.enabled) {
    return { ...info, ok: false, reason: 'firebase-admin is not initialised (no service account)' };
  }
  const list = (Array.isArray(tokens) ? tokens : [tokens]).filter(Boolean);
  if (!list.length) {
    return { ...info, ok: true, validated: 0, reason: 'no tokens supplied — credentials look usable' };
  }
  const res = await sendToTokens(
    list,
    { title: 'Firon dry run', body: 'Nothing was delivered.', ...msg },
    { dryRun: true },
  );
  return {
    ...info,
    ok: res.sent > 0 && res.failed === 0,
    validated: res.sent,
    failed: res.failed,
    invalidTokens: res.invalidTokens,
    error: res.error,
  };
}

module.exports = {
  init,
  isEnabled,
  status,
  sendToUser,
  sendToUsers,
  sendToTokens,
  sendDryRun,
  DEFAULT_CHANNEL_ID,
};
