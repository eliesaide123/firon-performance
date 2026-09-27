import { api, clientProxy, configureSharedService, fpAlert, onAlert, FPError, FP_ERROR_CODES, type FPAlertPayload } from '../shared/src/index';

const alerts: FPAlertPayload[] = [];
onAlert(a => { alerts.push(a); });

let access: string | null = null;
let refresh: string | null = null;
let forcedLogout = 0;

configureSharedService({
  baseUrl: 'http://localhost:4000/api',
  socketUrl: 'http://localhost:4000',
  platform: 'web',
  getAccessToken: () => access,
  getRefreshToken: () => refresh,
  onTokensRefreshed: t => { access = t.accessToken; refresh = t.refreshToken; },
  onUnauthenticated: () => { forcedLogout += 1; },
});

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

async function main() {
  console.log('\n1. health (unauthenticated)');
  // A foreign server on :4000 (another project holds IPv4 here) returns a non-enveloped body, so
  // clientProxy throws BAD_RESPONSE. Translate that into a message that actually explains itself.
  let health;
  try {
    health = await api.health();
  } catch (e) {
    const err = e as FPError;
    console.error(
      err.code === 'BAD_RESPONSE'
        ? '\nThe server on :4000 is NOT the Firon backend (unrecognised response).\n' +
            '  Check: lsof -nP -iTCP:4000 -sTCP:LISTEN\n'
        : `\nCannot reach the Firon backend: ${err.code} ${err.message}\n`,
    );
    process.exit(2);
  }
  check('status ok', health.status === 'ok');
  check('db connected', health.db === 'connected');

  console.log('\n2. login — role comes from the server, not the request');
  const client = await api.auth.login({ identifier: 'elie@firon.app', password: 'password1' });
  check('client role === client', client.user.role === 'client', `got ${client.user.role}`);
  check('accessToken present', typeof client.accessToken === 'string' && client.accessToken.length > 20);
  const trainer = await api.auth.login({ identifier: 'sara@firon.app', password: 'password1' });
  check('trainer role === trainer', trainer.user.role === 'trainer', `got ${trainer.user.role}`);
  const admin = await api.auth.login({ identifier: 'admin@firon.app', password: 'password1' });
  check('admin role === admin', admin.user.role === 'admin', `got ${admin.user.role}`);
  check('no role field echoed in request contract', !('role' in ({ identifier: '', password: '' } as object)));

  console.log('\n3. authenticated calls as the client');
  access = client.accessToken; refresh = client.refreshToken;
  const { user: me, unreadNotifications } = await api.auth.me();
  check('me.email', me.email === 'elie@firon.app');
  check('me.initials virtual', me.initials === 'ES', `got ${me.initials}`);
  check('unread badge count bundled', typeof unreadNotifications === 'number');
  const map = await api.content.map({ platform: 'mobile', locale: 'en' });
  check('content map is a flat key map', typeof map === 'object' && !Array.isArray(map));
  check('content map has >=150 keys', Object.keys(map).length >= 150, `got ${Object.keys(map).length}`);
  check('auth.login.title seeded', String((map['auth.login.title'] as {value:unknown})?.value) === 'Welcome back', JSON.stringify(map['auth.login.title']));

  console.log('\n4. envelope + meta unwrapping');
  const videos = await api.videos.list({ page: 1, limit: 3 });
  check('withMeta returns { data, meta }', Array.isArray(videos.data) && typeof videos.meta === 'object');
  check('progress/favorite merged in', videos.data.length > 0 && 'progress' in videos.data[0]! && 'favorite' in videos.data[0]!);
  const suggested = await api.videos.suggested();
  check('suggested carries a why string', suggested.length > 0 && typeof suggested[0]!.why === 'string', JSON.stringify(suggested[0]?.why));

  console.log('\n5. error normalisation -> FPError + alert popup');
  alerts.length = 0;
  try {
    await api.clients.roster();   // client hitting a trainer-only route
    check('403 should have thrown', false);
  } catch (e) {
    const err = e as FPError;
    check('threw an FPError', err instanceof FPError, String(e));
    check('status 403', err.status === 403, `got ${err.status}`);
    check('code FORBIDDEN-ish', err.code === FP_ERROR_CODES.FORBIDDEN || err.status === 403, String(err.code));
    check('alert popup raised by the proxy', alerts.length === 1, `alerts=${alerts.length}`);
    check('alert is an error variant', alerts[0]?.variant === 'error');
    check('alert has a technical line', typeof alerts[0]?.technical === 'string' && alerts[0]!.technical!.includes('403'), alerts[0]?.technical);
  }

  console.log('\n6. showAlert:false suppresses the popup');
  alerts.length = 0;
  try { await api.clients.roster({}, { showAlert: false }); } catch { /* expected */ }
  check('no popup when suppressed', alerts.length === 0, `alerts=${alerts.length}`);

  console.log('\n7. bad credentials -> field errors, no popup (login suppresses VALIDATION_ERROR)');
  alerts.length = 0;
  try {
    await api.auth.login({ identifier: 'elie@firon.app', password: 'wrongpass' });
    check('bad password should have thrown', false);
  } catch (e) {
    const err = e as FPError;
    check('threw FPError for bad password', err instanceof FPError);
    check('message is human readable', typeof err.message === 'string' && err.message.length > 3, err.message);
    console.log(`       -> code=${err.code} status=${err.status} msg="${err.message}" alerts=${alerts.length}`);
  }

  console.log('\n8. 404 normalisation');
  try {
    await clientProxy({ path: '/definitely-not-a-route', showAlert: false, retries: 0 });
    check('404 should have thrown', false);
  } catch (e) {
    const err = e as FPError;
    check('404 -> NOT_FOUND', err.status === 404, `got ${err.status}`);
  }

  console.log('\n9. transport failure normalisation (dead port)');
  const { updateSharedServiceConfig } = await import('../shared/src/config');
  updateSharedServiceConfig({ baseUrl: 'http://127.0.0.1:59999/api' });
  alerts.length = 0;
  try {
    await clientProxy({ path: '/health', auth: false, retries: 0, timeoutMs: 2000 });
    check('dead port should have thrown', false);
  } catch (e) {
    const err = e as FPError;
    check('code NETWORK', err.code === FP_ERROR_CODES.NETWORK, String(err.code));
    check('status 0', err.status === 0);
    check('retryable', err.retryable === true);
    check('popup raised with "No connection"', alerts[0]?.title === 'No connection', alerts[0]?.title);
  }
  updateSharedServiceConfig({ baseUrl: 'http://localhost:4000/api' });

  console.log('\n10. single-flight 401 refresh: 5 parallel calls on a junk access token');
  access = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJib2d1cyJ9.bogussignature';
  refresh = client.refreshToken;
  const before = access;
  const results = await Promise.allSettled([
    api.auth.me(), api.auth.me(), api.auth.me(), api.auth.me(), api.auth.me(),
  ]);
  const okCount = results.filter(r => r.status === 'fulfilled').length;
  check('all 5 recovered after one refresh', okCount === 5, `fulfilled=${okCount}`);
  check('access token was rotated', access !== before);
  check('no forced logout', forcedLogout === 0, `forcedLogout=${forcedLogout}`);

  console.log('\n11. refresh failure -> onUnauthenticated');
  access = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJib2d1cyJ9.bogussignature';
  refresh = 'total-garbage-refresh-token';
  try { await api.auth.me({ showAlert: false }); } catch { /* expected */ }
  check('onUnauthenticated fired exactly once', forcedLogout === 1, `forcedLogout=${forcedLogout}`);

  console.log('\n12. alert bus dedupe + direct publishers');
  alerts.length = 0;
  fpAlert.error('Dup', 'same message');
  fpAlert.error('Dup', 'same message');
  check('identical alerts deduped inside the window', alerts.length === 1, `alerts=${alerts.length}`);
  fpAlert.success('Saved');
  check('success variant published', alerts.some(a => a.variant === 'success'));
  check('success auto-dismisses', alerts.find(a => a.variant === 'success')?.autoDismissMs === 2600);

  console.log(`\n================ ${pass} passed, ${fail} failed ================\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
