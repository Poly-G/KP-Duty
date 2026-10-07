import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { passwordRecoveryUrl } from '../src/lib/auth/urls.ts';

const recoveryPath = '/auth/callback?next=/account/password';
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
