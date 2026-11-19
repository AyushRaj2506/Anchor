// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), download: vi.fn(), signedUpload: vi.fn(), signedDownload: vi.fn(), remove: vi.fn() }));
vi.mock('../../../server/clients.js', async importOriginal => ({ ...await importOriginal(), generateAIContent: mocks.generate }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: async token => token === 'valid-token' ? { data: { user: { id: 'user-1' } }, error: null } : { data: { user: null }, error: { status: 401 } } }, storage: { from: () => ({
  download: mocks.download, createSignedUploadUrl: mocks.signedUpload,
  createSignedUrl: mocks.signedDownload, remove: mocks.remove,
}) } }) }));

import analyze from '../../../api/ai/analyze.js';
import analyzeUrl from '../../../api/ai/analyze-url.js';
import analyzeFile from '../../../api/ai/analyze-resource.js';
import ask from '../../../api/ai/ask.js';
import upload from '../../../api/storage/create-upload-url.js';
import download from '../../../api/storage/create-download-url.js';
import remove from '../../../api/storage/delete-file.js';

const handlers = { analyze, analyzeUrl, analyzeFile, ask, upload, download, remove };
async function call(handler, body = {}, { method = 'POST', token = 'valid-token' } = {}) {
  const result = { code: 200, body: null };
  const res = { status(code) { result.code = code; return res; }, json(data) { result.body = data; return res; } };
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-public-key');
  mocks.generate.mockResolvedValue({ text: JSON.stringify({ summary: 'Grounded summary', contentText: 'Real document content', actionItems: [] }) });
  mocks.signedUpload.mockResolvedValue({ data: { signedUrl: 'https://example.supabase.co/upload' } });
  mocks.signedDownload.mockResolvedValue({ data: { signedUrl: 'https://example.supabase.co/download' } });
  mocks.remove.mockResolvedValue({ data: [] });
});
afterEach(() => vi.unstubAllEnvs());

describe('API authentication and request handling', () => {
  for (const [name, handler] of Object.entries(handlers)) {
    it(`${name} rejects missing authentication`, async () => {
      expect((await call(handler, {}, { token: null })).code).toBe(401);
    });
    it(`${name} rejects invalid authentication instead of silently using demo mode`, async () => {
      expect((await call(handler, {}, { token: 'bad-token' })).code).toBe(401);
    });
    it(`${name} rejects unsupported methods`, async () => {
      expect((await call(handler, {}, { method: 'GET' })).code).toBe(405);
    });
    it(`${name} handles missing/malformed JSON bodies without crashing`, async () => {
      expect((await call(handler, null)).code).toBe(400);
      expect((await call(handler, [])).code).toBe(400);
    });
  }
  it('reports missing AI configuration as a recoverable error', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect((await call(analyze, { text: 'Study this document.' })).code).toBe(503);
  });
  it('keeps text analysis independent of privileged storage credentials', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect((await call(analyze, { text: 'Study this document.' })).code).toBe(200);
  });
});

describe('Storage isolation', () => {
  it.each(['user-2/resource/file.pdf', 'user-1/../user-2/file.pdf', 'user-1/%2e%2e/file.pdf', 'user-1/dir\\..\\file.pdf', 'user-1//file.pdf'])('rejects unauthorized or ambiguous paths: %s', async storagePath => {
    expect((await call(download, { storagePath })).code).toBe(403);
    expect((await call(remove, { storagePath })).code).toBe(403);
    expect((await call(analyzeFile, { storagePath, fileType: 'application/pdf' })).code).toBe(403);
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it('rejects path traversal in resource IDs', async () => {
    expect((await call(upload, { resourceId: '../other', fileName: 'file.pdf', fileType: 'application/pdf', fileSize: 100 })).code).toBe(400);
  });
  it('rejects mismatched MIME types/extensions and oversized files', async () => {
    const body = { resourceId: 'resource', fileName: 'file.pdf', fileType: 'image/png', fileSize: 100 };
    expect((await call(upload, body)).code).toBe(400);
    expect((await call(upload, { ...body, fileType: 'application/pdf', fileSize: 21 * 1024 * 1024 })).code).toBe(400);
    expect(mocks.signedUpload).not.toHaveBeenCalled();
  });
  it('generates a signed upload URL within the verified user namespace', async () => {
    const result = await call(upload, { resourceId: 'resource', fileName: 'file.pdf', fileType: 'application/pdf', fileSize: 100 });
    expect(result.code).toBe(200);
    expect(result.body.data.path).toMatch(/^user-1\/resource\/[^/]+\.pdf$/);
  });
  it('returns a controlled error when storage credentials are missing', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect((await call(download, { storagePath: 'user-1/resource/file.pdf' })).code).toBe(503);
  });
});

describe('AI output and context validation', () => {
  it('returns actionable quota and timeout errors', async () => {
    mocks.generate.mockRejectedValueOnce(Object.assign(new Error('Quota exceeded'), { status: 429 }));
    const quota = await call(analyze, { text: 'Course notes.' });
    expect(quota.code).toBe(429);
    expect(quota.body.error).toMatch(/quota/);
    mocks.generate.mockRejectedValueOnce(Object.assign(new Error('Deadline expired'), { status: 504 }));
    const timeout = await call(analyze, { text: 'Course notes.' });
    expect(timeout.code).toBe(504);
    expect(timeout.body.error).toMatch(/timed out/);
  });
  it.each(['null', '[]', 'not JSON'])('rejects malformed AI output: %s', async output => {
    mocks.generate.mockResolvedValue({ text: output });
    expect((await call(analyze, { text: 'Course notes.' })).code).toBe(502);
  });
  it('sanitizes nested action fields so model objects cannot crash React rendering', async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ actionItems: [{ title: 'Read', description: { invalid: true }, deadline: 123 }] }) });
    const result = await call(analyze, { text: 'Read chapter 1.' });
    expect(result.body.data.actionItems).toEqual([{ title: 'Read', description: null, deadline: null }]);
  });
  it('rejects malformed and oversized knowledge contexts', async () => {
    expect((await call(ask, { question: 'Why?', context: { resources: [null], tasks: [] } })).code).toBe(400);
    expect((await call(ask, { question: 'Why?', context: { resources: Array(9).fill({ id: '1', title: 'Notes' }), tasks: [] } })).code).toBe(413);
  });
  it('never exposes invented source IDs or titles as citations', async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ answer: 'Answer', confidence: 'high', notFound: false, sources: [
      { type: 'resource', id: 'invented', title: 'Invented' },
      { type: 'resource', id: 'real', title: 'Model invented title' },
    ] }) });
    const result = await call(ask, { question: 'Question?', context: { resources: [{ id: 'real', title: 'Actual title', content: 'Notes' }], tasks: [] } });
    expect(result.body.data.sources).toEqual([{ id: 'real', type: 'resource', title: 'Actual title' }]);
  });
  it('does not present an answer as grounded when every source is fabricated', async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ answer: 'Invented fact', confidence: 'high', notFound: false, sources: [{ type: 'resource', id: 'fake' }] }) });
    const result = await call(ask, { question: 'Question?', context: { resources: [], tasks: [] } });
    expect(result.body.data.notFound).toBe(true);
    expect(result.body.data.answer).not.toContain('Invented fact');
  });
});
