import assert from 'node:assert/strict';

const endpoints = [
  'ai/analyze', 'ai/analyze-url', 'ai/analyze-resource', 'ai/ask',
  'storage/create-upload-url', 'storage/create-download-url', 'storage/delete-file',
];

// Use real imports with no credentials: mocks must not hide runtime dependency
// failures. CI runs this after removing development-only dependencies.
for (const endpoint of endpoints) {
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
