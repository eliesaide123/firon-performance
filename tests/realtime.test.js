const { io } = require('../backend/node_modules/socket.io-client');
const API = 'http://localhost:4000/api';
const SOCK = 'http://localhost:4000';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`)); };

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}
const login = async (identifier) => (await call('/auth/login', { method: 'POST', body: { identifier, password: 'password1' } })).json.data;

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

function waitFor(sock, event, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), ms);
    sock.once(event, p => { clearTimeout(t); resolve(p); });
  });
}
const connect = (token) => new Promise((resolve, reject) => {
  const s = io(SOCK, { auth: { token }, transports: ['websocket'], reconnection: false });
  s.on('connect', () => resolve(s));
  s.on('connect_error', e => reject(new Error('connect_error: ' + e.message)));
  setTimeout(() => reject(new Error('socket connect timeout')), 8000);
});

(async () => {
  await assertFironBackend();

  console.log('\n1. JWT handshake');
  const admin = await login('admin@firon.app');
  const client = await login('elie@firon.app');
  const trainer = await login('sara@firon.app');

  let rejected = false;
  try { await connect('garbage.token.here'); } catch (e) { rejected = /connect_error/.test(e.message); }
  check('unauthenticated socket rejected', rejected);

  const adminSock = await connect(admin.accessToken);
  const clientSock = await connect(client.accessToken);
  const trainerSock = await connect(trainer.accessToken);
  check('admin socket connected', adminSock.connected);
  check('client socket connected', clientSock.connected);
  check('trainer socket connected', trainerSock.connected);

  console.log('\n2. "connected" handshake payload + rooms');
  const conn = await new Promise(r => { const s = io(SOCK, { auth: { token: client.accessToken }, transports: ['websocket'], reconnection: false }); s.on('connected', p => r({ p, s })); });
  check('connected carries userId', typeof conn.p.userId === 'string');
  check('connected carries role=client', conn.p.role === 'client', JSON.stringify(conn.p.role));
  check('joined user + content rooms', Array.isArray(conn.p.rooms) && conn.p.rooms.some(r => r.startsWith('user:')) && conn.p.rooms.some(r => r.startsWith('content:')), JSON.stringify(conn.p.rooms));
  conn.s.close();

  console.log('\n3. content:updated reaches BOTH the mobile client and the CMS');
  const item = (await call('/content?format=list&limit=1&group=auth', { token: admin.accessToken })).json.data[0];
  const originalValue = item.value; // restore THIS, never a hardcoded guess
  const onClient = waitFor(clientSock, 'content:updated');
  const onAdmin = waitFor(adminSock, 'content:updated');
  const newValue = `${originalValue} __probe_${Date.now()}`;
  const put = await call(`/content/${item.id}`, { method: 'PUT', token: admin.accessToken, body: { value: newValue } });
  check('PUT /content/:id succeeded', put.status === 200, `status ${put.status} ${JSON.stringify(put.json?.error)}`);
  const [cEvt, aEvt] = await Promise.all([onClient, onAdmin]);
  check('client received content:updated', cEvt.key === item.key, JSON.stringify(cEvt).slice(0, 120));
  check('payload carries the new value', cEvt.value === newValue, String(cEvt.value));
  check('payload carries type + locale', typeof cEvt.type === 'string' && typeof cEvt.locale === 'string');
  check('CMS socket also received it', aEvt.key === item.key);
  await call(`/content/${item.id}`, { method: 'PUT', token: admin.accessToken, body: { value: originalValue } });
  const restored = (await call(`/content/${item.key}`, { token: admin.accessToken })).json.data;
  check('content value restored exactly', restored.value === originalValue, `got ${JSON.stringify(restored.value)}`);

  console.log('\n4. content:bulk-updated');
  const two = (await call('/content?format=list&limit=2&group=common', { token: admin.accessToken })).json.data;
  const onBulk = waitFor(clientSock, 'content:bulk-updated');
  const bulk = await call('/content/bulk', { method: 'PATCH', token: admin.accessToken, body: { items: two.map(i => ({ key: i.key, value: i.value })) } });
  check('PATCH /content/bulk succeeded', bulk.status === 200, `status ${bulk.status} ${JSON.stringify(bulk.json?.error)}`);
  const bEvt = await onBulk;
  check('bulk event has items + count', Array.isArray(bEvt.items) && bEvt.count >= 1, JSON.stringify(bEvt).slice(0, 120));
  const afterBulk = await Promise.all(two.map(i => call(`/content/${i.key}`, { token: admin.accessToken })));
  check('bulk probe left values untouched', afterBulk.every((r, i) => r.json.data.value === two[i].value));

  console.log('\n5. room isolation: a client must NOT get trainer-only events');
  let leaked = false;
  clientSock.on('plan:progress', () => { leaked = true; });
  clientSock.on('roster:updated', () => { leaked = true; });

  console.log('\n6. client check-off -> plan:progress reaches the TRAINER');
  const plan = (await call('/plans/training/me', { token: client.accessToken })).json.data;
  const dayIdx = plan.currentDayIndex >= 0 ? plan.currentDayIndex : 2;
  const onProgress = waitFor(trainerSock, 'plan:progress', 10000);
  const toggle = await call(`/plans/training/${plan.id}/day/${dayIdx}/exercise/2/toggle`, { method: 'PATCH', token: client.accessToken });
  check('toggle succeeded', toggle.status === 200, `status ${toggle.status} ${JSON.stringify(toggle.json?.error)}`);
  const prog = await onProgress;
  check('trainer got plan:progress', prog.planId === plan.id, JSON.stringify(prog).slice(0, 140));
  check('progress has doneCount/total/adherencePct', typeof prog.doneCount === 'number' && typeof prog.total === 'number' && typeof prog.adherencePct === 'number');
  await call(`/plans/training/${plan.id}/day/${dayIdx}/exercise/2/toggle`, { method: 'PATCH', token: client.accessToken });

  console.log('\n7. notification:new — in-app realtime (the FCM-independent channel)');
  const onNotif = waitFor(clientSock, 'notification:new', 10000);
  const test = await call('/notifications/test', { method: 'POST', token: admin.accessToken, body: { userId: client.user.id, title: 'Socket test', body: 'Realtime in-app notification' } });
  check('POST /notifications/test succeeded', test.status === 200 || test.status === 201, `status ${test.status} ${JSON.stringify(test.json?.error)}`);
  const nEvt = await onNotif;
  check('client got notification:new', nEvt.notification?.title === 'Socket test', JSON.stringify(nEvt).slice(0, 140));
  check('notification persisted with an id', typeof nEvt.notification?.id === 'string');

  console.log('\n8. video:updated broadcast');
  const vid = (await call('/videos?limit=1', { token: admin.accessToken })).json.data[0];
  const onVid = waitFor(clientSock, 'video:updated');
  const vp = await call(`/videos/${vid.id}`, { method: 'PUT', token: admin.accessToken, body: { title: vid.title } });
  check('PUT /videos/:id succeeded', vp.status === 200, `status ${vp.status}`);
  const vEvt = await onVid;
  check('client got video:updated', vEvt.video?.id === vid.id);

  console.log('\n9. room isolation result');
  check('no trainer-only events leaked to the client', leaked === false);

  console.log(`\n================ ${pass} passed, ${fail} failed ================\n`);
  [adminSock, clientSock, trainerSock].forEach(s => s.close());
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('\nHARNESS ERROR:', e.message); process.exit(2); });
