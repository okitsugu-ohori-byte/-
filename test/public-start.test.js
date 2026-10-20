import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

function childExit(child) {
  return new Promise((resolve, reject) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
    child.once('error', reject);
  });
}

test('public startup refuses missing password or an HTTP origin', async () => {
  for (const vars of [{ APP_PASSWORD: '', APP_ORIGIN: 'https://example.com' }, { APP_PASSWORD: 'test-only', APP_ORIGIN: 'http://example.com' }]) {
    const child = spawn('node', ['scripts/start-public.mjs'], { env: { ...process.env, ...vars }, stdio: 'ignore' });
    const { code } = await childExit(child);
    assert.notEqual(code, 0);
  }
});

test('public mode protects all routes, permits its HTTPS origin, preserves disk data and OAuth preferences across restarts', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'kaden-public-'));
  const password = randomBytes(24).toString('hex');
  const origin = 'https://kaden-test.onrender.com';
  const port = 3032;
  const headers = { Authorization: 'Basic ' + Buffer.from('admin:' + password).toString('base64') };
  const env = { ...process.env, DATA_DIR: dataDir, APP_PASSWORD: password, APP_ORIGIN: '', RENDER_EXTERNAL_URL: origin, GOOGLE_REDIRECT_URI: '', HOST: '127.0.0.1', PORT: String(port) };
  const base = `http://127.0.0.1:${port}`;
  let child, exited;
  async function boot() {
    child = spawn('node', ['scripts/start-public.mjs'], { env, stdio: 'ignore' });
    exited = childExit(child);
    for (let i = 0; i < 100; i++) {
      try { const r = await fetch(base + '/api/health', { headers }); if (r.ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Public service did not become ready');
  }
  try {
    await boot();
    for (const path of ['/', '/api/state', '/api/health', '/api/documents']) {
      assert.equal((await fetch(base + path)).status, 401, path + ' requires authentication');
    }
    const auth = await fetch(base + '/', { headers });
    assert.equal(auth.status, 200);
    assert.match(await auth.text(), /KADEN/);
    const state = await (await fetch(base + '/api/state', { headers })).json();
    assert.equal(state.config.redirectUri, origin + '/api/google/callback');
    const response = await fetch(base + '/api/tasks', { method: 'POST', headers: { ...headers, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '公開時の保存検証', dueDate: '2026-11-01' }) });
    assert.equal(response.status, 200);
    const task = await response.json();
    const forbidden = await fetch(base + '/api/tasks', { method: 'POST', headers: { ...headers, Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '拒否される操作' }) });
    assert.equal(forbidden.status, 403);
    const customRedirect = 'https://custom.example/api/google/callback';
    assert.equal((await fetch(base + '/api/settings', { method: 'PUT', headers: { ...headers, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ config: { ...state.config, redirectUri: customRedirect } }) })).status, 200);
    child.kill('SIGTERM');
    assert.equal((await exited).code, 0);
    await boot();
    const restored = await (await fetch(base + '/api/state', { headers })).json();
    assert.ok(restored.tasks.some(t => t.id === task.id));
    assert.equal(restored.config.redirectUri, customRedirect);
  } finally {
    if (child && child.exitCode === null) { child.kill('SIGTERM'); await exited; }
  }
});
