import assert from 'node:assert/strict';

const endpoints = [
  'ai/analyze', 'ai/analyze-url', 'ai/analyze-resource', 'ai/ask',
  'storage/create-upload-url', 'storage/create-download-url', 'storage/delete-file',
  'jobs/create', 'jobs/status', 'jobs/run', 'maintenance/run',
];
const remote = process.argv.includes('--live') ? process.argv[process.argv.indexOf('--live') + 1] : null;
if (process.argv.includes('--live')) {
  const base = new URL(remote);
  assert.equal(base.protocol, 'https:');
  const page = await fetch(base, { signal: AbortSignal.timeout(20000) });
  assert.equal(page.status, 200, 'Production homepage');
  assert.match(await page.text(), /<script[^>]+src=/, 'Production application bundle');
}

// Use real imports with no credentials: mocks must not hide runtime dependency
// failures. CI runs this after removing development-only dependencies.
for (const endpoint of endpoints) {
  if (remote) {
    const response = await fetch(new URL('/api/' + endpoint, remote), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 401, endpoint + ' must reject unauthenticated requests');
    assert.equal((await response.json()).success, false);
    console.log('PASS live /api/' + endpoint);
    continue;
  }
  const { default: handler } = await import(new URL('../api/' + endpoint + '.js', import.meta.url));
  assert.equal(typeof handler, 'function', endpoint);
  let status;
  let result;
  const response = {
    status(code) { status = code; return response; },
    json(body) { result = body; return response; },
  };
  await handler({ method: 'POST', headers: {}, body: {} }, response);
  assert.equal(status, 401, endpoint + ' must load and reject unauthenticated requests');
  assert.equal(result.success, false, endpoint);
  console.log('PASS /api/' + endpoint);
}
