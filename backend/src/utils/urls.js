'use strict';

const { env } = require('../config');

/** The public origin for this request (PUBLIC_URL wins, then the request host). */
function baseUrl(req) {
  if (env.PUBLIC_URL) return env.PUBLIC_URL.replace(/\/+$/, '');
  if (!req) return `http://localhost:${env.PORT}`;
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${env.PORT}`;
  return `${proto}://${host}`;
}

/**
 * Turns a stored relative path ('/uploads/x.mp4') into an absolute URL.
 * Absolute URLs and data URIs pass through untouched.
 */
function absoluteUrl(req, stored) {
  if (!stored || typeof stored !== 'string') return stored || null;
  if (/^(https?:)?\/\//i.test(stored) || stored.startsWith('data:')) return stored;
  const path = stored.startsWith('/') ? stored : `/${stored}`;
  return `${baseUrl(req)}${path}`;
}

/** Shallow-maps a media-ish doc adding absolute `url` / `thumbnailUrl`. */
function withAbsoluteMedia(req, doc) {
  if (!doc) return doc;
  const o = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  if (o.url) o.url = absoluteUrl(req, o.url);
  if (o.thumbnailUrl) o.thumbnailUrl = absoluteUrl(req, o.thumbnailUrl);
  return o;
}

module.exports = { baseUrl, absoluteUrl, withAbsoluteMedia };
