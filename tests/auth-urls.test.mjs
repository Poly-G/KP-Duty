import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { passwordRecoveryUrl, authCallbackUrl } from '../src/lib/auth/urls.ts';

test('Render callback uses the public URL rather than internal localhost for success and failure', () => {
  for (const path of ['/account/password', '/login?error=expired']) {
    assert.equal(authCallbackUrl(path, 'https://localhost:10000/auth/callback', 'https://kp-duty-webmcp-test.onrender.com').href,
      `https://kp-duty-webmcp-test.onrender.com${path}`);
  }
});
test('production and local callbacks preserve their request origins', () => {
  for (const origin of ['https://kp-duty.vercel.app', 'http://localhost:3000']) {
    assert.equal(authCallbackUrl('/account/password', `${origin}/auth/callback`).href, `${origin}/account/password`);
  }
});
test('callback next cannot redirect outside the app', () => {
  for (const path of [null, 'https://evil.example', '//evil.example', '/\\\\evil.example']) {
    assert.equal(authCallbackUrl(path, 'https://app.example/auth/callback').href, 'https://app.example/');
  }
});

const recoveryPath = '/auth/callback?next=/account/password';
test('custom domain callbacks stay on the trusted incoming host', () => {
  const args = ['https://localhost:10000/auth/callback', 'https://app.onrender.com', 'https://mettlesite.com'];
  assert.equal(authCallbackUrl('/account/password', ...args, 'mettlesite.com').origin, 'https://mettlesite.com');
  assert.equal(authCallbackUrl('/account/password', ...args, 'app.onrender.com').origin, 'https://app.onrender.com');
  assert.equal(authCallbackUrl('/account/password', ...args, 'evil.example').origin, 'https://app.onrender.com');
});
test('Render recovery stays on Render even with the production site URL', () => {
  assert.equal(passwordRecoveryUrl('https://kp-duty-webmcp-test.onrender.com', 'https://kp-duty.vercel.app'),
    `https://kp-duty-webmcp-test.onrender.com${recoveryPath}`);
});
test('production and local browser recovery keep their current origins', () => {
  for (const origin of ['https://kp-duty.vercel.app', 'http://localhost:3000']) {
    assert.equal(passwordRecoveryUrl(origin), `${origin}${recoveryPath}`);
  }
});
test('non-browser calls use the configured site origin, then localhost', () => {
  assert.equal(passwordRecoveryUrl(null, 'https://kp-duty.vercel.app/'), `https://kp-duty.vercel.app${recoveryPath}`);
  assert.equal(passwordRecoveryUrl(null), `http://localhost:3000${recoveryPath}`);
});
test('invalid and non-HTTP origins cannot become recovery redirects', () => {
  for (const origin of ['null', 'invalid', 'javascript:alert(1)', 'https://user:pass@example.com']) {
    assert.equal(passwordRecoveryUrl(origin, 'https://configured.example'), `https://configured.example${recoveryPath}`);
  }
});
test('Forgot password remains relative and the action uses the tested URL builder', async () => {
  const login = await readFile(new URL('../src/app/(auth)/login/page.tsx', import.meta.url), 'utf8');
  assert.match(login, /href="\/forgot-password"/);
  const action = await readFile(new URL('../src/app/actions/auth.ts', import.meta.url), 'utf8');
  assert.match(action, /redirectTo: passwordRecoveryUrl\(/);
  assert.match(action, /requestHeaders.get\("origin"\)/);
});
