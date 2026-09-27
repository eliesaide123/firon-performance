/* Tiny logger so nothing fails silently (CONTRACT §10). */
const prefix = '[firon]';

export const log = {
  info: (...args: unknown[]): void => console.log(prefix, ...args),
  warn: (...args: unknown[]): void => console.warn(prefix, ...args),
  error: (...args: unknown[]): void => console.error(prefix, ...args),
};

export default log;
