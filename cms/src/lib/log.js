/* Tiny logger (CONTRACT §10 — no silent failures). */
const enabled = import.meta.env.DEV;
const stamp = () => new Date().toISOString().slice(11, 23);

export const log = {
  debug: (...a) => { if (enabled) console.debug(`[cms ${stamp()}]`, ...a); },
  info: (...a) => { if (enabled) console.info(`[cms ${stamp()}]`, ...a); },
  warn: (...a) => console.warn(`[cms ${stamp()}]`, ...a),
  error: (...a) => console.error(`[cms ${stamp()}]`, ...a),
};

export default log;
