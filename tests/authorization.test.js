const API = 'http://localhost:4000/api';
let pass = 0, fail = 0;
const check = (n, c, x = '') => { c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`)); };
const call = async (p, { method = 'GET', token, body } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => null) };
};
/**
 * Fail fast and loudly if we are not talking to the Firon backend.
 *
 * On this machine an unrelated project also listens on :4000 (IPv4), which forces the Firon
 * server to bind IPv6-only. Tools then disagree about `localhost`: curl prefers IPv4 (the wrong
 * server), Node's fetch prefers IPv6 (the right one). Without this check a suite could appear to
 * pass — or fail confusingly — against a completely different application.
 */
async function assertFironBackend() {
  let health;
  try {
    health = await call('/health');
  } catch (e) {
    console.error(`\nCannot reach a server at ${API}\n  ${e.message}\n  Start it: npm --prefix backend run dev\n`);
    process.exit(2);
  }
  const d = health.json && health.json.data;
  const isFiron = health.json && health.json.success === true && d && d.status === 'ok' && 'db' in d;
  if (!isFiron) {
    console.error(
      `\nThe server at ${API} is NOT the Firon backend.\n` +
      `  got: ${JSON.stringify(health.json).slice(0, 160)}\n` +
      `  Another process is probably holding port 4000. Check with:\n` +
      `    lsof -nP -iTCP:4000 -sTCP:LISTEN\n` +
      `  Then either stop it, or run the Firon backend on another port and set API/SOCK here.\n`,
    );
    process.exit(2);
  }
  if (d.db !== 'connected') {
    console.error(`\nThe Firon backend is up but MongoDB is '${d.db}'. Start mongod and seed.\n`);
    process.exit(2);
  }
}

const login = async id => (await call('/auth/login', { method: 'POST', body: { identifier: id, password: 'password1' } })).json.data;

(async () => {
  await assertFironBackend();

  const users = {};
  for (const e of ['elie@firon.app', 'maya@firon.app', 'sara@firon.app', 'admin@firon.app']) users[e] = await login(e);

  console.log('\n1. every user sees ONLY their own notifications');
  for (const [email, u] of Object.entries(users)) {
    const r = await call('/notifications?limit=100', { token: u.accessToken });
    const foreign = (r.json.data || []).filter(n => n.userId !== u.user.id);
    check(`${email} — no foreign rows (${r.json.data?.length ?? 0} total)`, foreign.length === 0,
      foreign.length ? JSON.stringify(foreign.map(n => n.userId)) : '');
  }

  console.log('\n2. unread counts agree across the three surfaces');
  for (const [email, u] of Object.entries(users)) {
    const me = await call('/auth/me', { token: u.accessToken });
    const cnt = await call('/notifications/unread-count', { token: u.accessToken });
    const list = await call('/notifications?limit=100', { token: u.accessToken });
    const a = me.json.data.unreadNotifications, b = cnt.json.data.unread, c = list.json.meta.unread;
    check(`${email} — /auth/me=${a} /unread-count=${b} meta.unread=${c}`, a === b && b === c);
  }

  console.log('\n3. a client cannot read another client\'s plan');
  const mayaPlan = (await call(`/plans/training?clientId=${users['maya@firon.app'].user.id}`, { token: users['sara@firon.app'].accessToken })).json.data?.[0];
  check('trainer can list their client\'s plan', Boolean(mayaPlan));
  if (mayaPlan) {
    const asElie = await call(`/plans/training/${mayaPlan.id}`, { token: users['elie@firon.app'].accessToken });
    check('Elie is refused Maya\'s plan by id', asElie.status === 403 || asElie.status === 404, `status ${asElie.status}`);
    const toggleOther = await call(`/plans/training/${mayaPlan.id}/day/0/exercise/0/toggle`, { method: 'PATCH', token: users['elie@firon.app'].accessToken });
    check('Elie cannot toggle Maya\'s exercise', toggleOther.status >= 400, `status ${toggleOther.status}`);
  }

  console.log('\n4. a client cannot reach trainer- or admin-only surfaces');
  for (const [p, m] of [['/clients', 'GET'], ['/clients/stats', 'GET'], ['/trainer/profile', 'GET'], ['/users', 'GET'], ['/dashboard', 'GET'], ['/media', 'GET']]) {
    const r = await call(p, { method: m, token: users['elie@firon.app'].accessToken });
    check(`client blocked from ${p}`, r.status === 403, `status ${r.status}`);
  }

  console.log('\n5. a trainer cannot reach admin-only surfaces');
  for (const p of ['/users', '/dashboard']) {
    const r = await call(p, { token: users['sara@firon.app'].accessToken });
    check(`trainer blocked from ${p}`, r.status === 403, `status ${r.status}`);
  }
  const contentWrite = await call('/content/000000000000000000000000', { method: 'PUT', token: users['sara@firon.app'].accessToken, body: { value: 'nope' } });
  check('trainer cannot write CMS content', contentWrite.status === 403, `status ${contentWrite.status}`);

  console.log('\n6. another trainer\'s roster is not visible');
  const roster = (await call('/clients', { token: users['sara@firon.app'].accessToken })).json.data || [];
  check('Sara sees her 5 seeded clients', roster.length === 5, `got ${roster.length}`);

  console.log(`\n================ ${pass} passed, ${fail} failed ================\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
