'use strict';

const logger = require('../utils/logger');
const { env } = require('../config');

/**
 * Dev stub mail transport.
 *
 * It logs the message (including the OTP, loudly) instead of sending it.
 * To go live, replace the body of `send()` with a real provider call
 * (nodemailer / SendGrid / SES) — the signature is all the rest of the
 * codebase depends on:
 *
 *   await mailService.send({ to, subject, text, html })
 *   await mailService.sendOtp(to, code, purpose)
 */
async function send({ to, subject, text, html }) {
  logger.info({ to, subject, provider: 'stub' }, '[mail] (dev stub — not actually sent)');
  if (env.isDev) logger.debug({ to, text: text || html }, '[mail] body');
  return { ok: true, provider: 'stub', to };
}

async function sendOtp(to, code, purpose = 'verify') {
  const subject = purpose === 'reset' ? 'Reset your Firon Performance password' : 'Verify your Firon Performance account';
  // Deliberately loud so it is impossible to miss in the dev console.
  logger.info(`\n  ===============================================\n  [mail] OTP for ${to}  ->  ${code}   (purpose: ${purpose})\n  ===============================================\n`);
  return send({ to, subject, text: `Your Firon Performance verification code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes.` });
}

module.exports = { send, sendOtp };
