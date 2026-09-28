const { io } = require('/Users/es/git/firon-performance/backend/node_modules/socket.io-client');
const API = 'http://[::1]:4000/api';
let pass = 0, fail = 0;
const ck = (n, c, x = '') => { c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`)); };
const call = async (p, o = {}) => {
  const r = await fetch(API + p, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json', ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const login = async id => (await call('/auth/login', { method: 'POST', body: { identifier: id, password: 'password1' } })).json.data;

(async () => {
  const admin = await login('admin@firon.app');
  const victim = await login('maya@firon.app');
  ck('victim logged in', Boolean(victim?.accessToken));

  // two "devices" for the same user
  const mk = () => new Promise((res, rej) => {
    const s = io('http://[::1]:4000', { auth: { token: victim.accessToken }, transports: ['websocket'], reconnection: false });
    s.on('connect', () => res(s)); s.on('connect_error', rej); setTimeout(() => rej(new Error('timeout')), 8000);
  });
  const a = await mk(), b = await mk();
  ck('two sockets connected', a.connected && b.connected);

  const got = [];
  const waitFor = s => new Promise(r => s.once('account:deactivated', p => { got.push(p); r(p); }));
  const gone  = s => new Promise(r => s.once('disconnect', () => r(true)));
  const pA = waitFor(a), pB = waitFor(b), dA = gone(a), dB = gone(b);

  console.log('\n  admin deactivates the account…');
  const res = await call(`/users/${victim.user.id}/active`, { method: 'PATCH', token: admin.accessToken, body: { isActive: false } });
  ck('PATCH active=false succeeded', res.status === 200, JSON.stringify(res.json?.error));
  ck('server reports sockets disconnected', res.json?.data?.socketsDisconnected >= 2, `got ${res.json?.data?.socketsDisconnected}`);

  const evA = await Promise.race([pA, new Promise(r => setTimeout(() => r(null), 6000))]);
  const evB = await Promise.race([pB, new Promise(r => setTimeout(() => r(null), 6000))]);
  ck('device A received account:deactivated', Boolean(evA), JSON.stringify(evA));
  ck('device B received it too', Boolean(evB));
  ck('payload carries the reason', evA?.reason === 'deactivated', JSON.stringify(evA));

  ck('device A was disconnected', await Promise.race([dA, new Promise(r => setTimeout(() => r(false), 6000))]));
  ck('device B was disconnected', await Promise.race([dB, new Promise(r => setTimeout(() => r(false), 6000))]));

  console.log('\n  their tokens must now be dead:');
  const me = await call('/auth/me', { token: victim.accessToken });
  ck('access token rejected (403 ACCOUNT_DISABLED)', me.status === 403 && me.json?.error?.code === 'ACCOUNT_DISABLED', `status ${me.status} code ${me.json?.error?.code}`);
  const rf = await call('/auth/refresh', { method: 'POST', body: { refreshToken: victim.refreshToken } });
  ck('refresh token rejected too', rf.status === 403 && rf.json?.error?.code === 'ACCOUNT_DISABLED', `status ${rf.status}`);
  const relog = await call('/auth/login', { method: 'POST', body: { identifier: 'maya@firon.app', password: 'password1' } });
  ck('cannot log back in while deactivated', relog.status >= 400, `status ${relog.status}`);

  console.log('\n  the message the user sees comes from the CMS (public endpoint):');
  const cms = await call('/content?format=map&group=account&platform=mobile');
  const m = cms.json?.data || {};
  ck('account.deactivated_title is CMS-served', Boolean(m['account.deactivated_title']?.value), JSON.stringify(m['account.deactivated_title']));
  ck('account.deactivated_body is CMS-served', Boolean(m['account.deactivated_body']?.value));
  console.log('       title:', JSON.stringify(m['account.deactivated_title']?.value));
  console.log('       body: ', JSON.stringify(m['account.deactivated_body']?.value));

  console.log('\n  restoring Maya…');
  await call(`/users/${victim.user.id}/active`, { method: 'PATCH', token: admin.accessToken, body: { isActive: true } });
  const back = await call('/auth/login', { method: 'POST', body: { identifier: 'maya@firon.app', password: 'password1' } });
  ck('can log in again once reactivated', back.status === 200, `status ${back.status}`);

  console.log(`\n  ===== ${pass} passed, ${fail} failed =====\n`);
  [a, b].forEach(s => { try { s.close(); } catch {} });
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('  HARNESS ERROR', e.message); process.exit(2); });
