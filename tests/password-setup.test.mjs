import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordSetup } from '../src/lib/auth/password-setup.ts';
const deadline = () => Date.now() + 60_000;
function fake(overrides = {}) {
  const calls = [];
  return { calls, auth: {
    verifyOtp: async (args) => { calls.push(['verify', args]); return { data: { session: {} }, error: null }; },
    updateUser: async (args) => { calls.push(['update', args]); return { error: null }; },
    signOut: async (args) => { calls.push(['signOut', args]); return { error: null }; },
    ...overrides,
  }};
}
test('invalid inputs never consume the token or change a password', async () => {
  const {auth, calls} = fake(); const save = passwordSetup(auth, 'secret', deadline());
  assert.match(await save('short', 'short'), /8 characters/);
  assert.match(await save('long-enough', 'different'), /match/);
  assert.deepEqual(calls, []);
});
test('missing and expired links cannot update passwords', async () => {
  const {auth, calls} = fake();
  assert.match(await passwordSetup(auth, '', deadline())('long-enough', 'long-enough'), /complete/);
  assert.match(await passwordSetup(auth, 'secret', 1)('long-enough', 'long-enough'), /expired/);
  assert.deepEqual(calls, []);
});
test('rejected native token never reaches password update', async () => {
  const {auth, calls} = fake({verifyOtp: async () => ({data: {}, error: {}})});
  assert.match(await passwordSetup(auth, 'bad', deadline())('long-enough', 'long-enough'), /invalid/);
  assert.deepEqual(calls, []);
});
test('success verifies once, updates, signs out and blocks reuse', async () => {
  const {auth, calls} = fake(); const save = passwordSetup(auth, 'secret', deadline());
  assert.equal(await save('long-enough', 'long-enough'), null);
  assert.match(await save('long-enough', 'long-enough'), /already been used/);
  assert.deepEqual(calls.map(c => c[0]), ['verify','update','signOut']);
  assert.deepEqual(calls[0][1], {token_hash:'secret',type:'recovery'});
});
test('password policy errors can retry without consuming another token', async () => {
  let attempts = 0;
  const {auth, calls} = fake({updateUser: async () => ({error: ++attempts === 1 ? {} : null})});
  const save = passwordSetup(auth, 'secret', deadline());
  assert.match(await save('long-enough', 'long-enough'), /different password/);
  assert.equal(await save('better-password', 'better-password'), null);
  assert.equal(calls.filter(c => c[0] === 'verify').length, 1);
});
test('concurrent submissions cannot perform two updates', async () => {
  let resolve; const pending = new Promise(r => {resolve = r});
  let updates = 0;
  const {auth} = fake({updateUser: async () => {updates++; await pending; return {error:null}}});
  const save = passwordSetup(auth, 'secret', deadline());
  const first = save('long-enough','long-enough');
  assert.match(await save('long-enough','long-enough'), /in progress/);
  resolve(); assert.equal(await first, null); assert.equal(updates, 1);
});
test('sign-out transport failure does not misreport a saved password', async () => {
  const {auth} = fake({signOut: async () => {throw new Error('offline')}});
  assert.equal(await passwordSetup(auth, 'secret', deadline())('long-enough','long-enough'), null);
});
