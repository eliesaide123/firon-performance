'use strict';

const logger = require('../utils/logger');
const { env } = require('../config');

/**
 * Dev stub SMS transport — same contract as mailService.
 * Swap the body of `send()` for Twilio / Vonage / a local gateway to go live:
 *
 *   await smsService.send({ to, body })
 *   await smsService.sendOtp(to, code, purpose)
 */
async function send({ to, body }) {
  logger.info({ to, provider: 'stub' }, '[sms] (dev stub — not actually sent)');
  if (env.isDev) logger.debug({ to, body }, '[sms] body');
  return { ok: true, provider: 'stub', to };
}

async function sendOtp(to, code, purpose = 'verify') {
  logger.info(`\n  ===============================================\n  [sms] OTP for ${to}  ->  ${code}   (purpose: ${purpose})\n  ===============================================\n`);
  return send({ to, body: `Firon Performance: your code is ${code} (expires in ${env.OTP_TTL_MINUTES} min).` });
}

module.exports = { send, sendOtp };
