// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import net from 'node:net';
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../server/clients.js', () => ({ getStorageClient: () => ({ rpc: mocks.rpc }) }));
import { requireAIBudget, INTERNAL_JOB } from '../../../server/usage.js';
import { inspectBlob, validateFileBytes, scanFile } from '../../../server/inspection.js';
import { tasksForJob } from '../../../server/job-tasks.js';
import { loadKnowledge } from '../../../server/knowledge.js';

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CLAMAV_HOST', ''); mocks.rpc.mockResolvedValue({ data: null, error: null }); });
afterEach(() => vi.unstubAllEnvs());
function response() {
  const res = { status: vi.fn(() => res), json: vi.fn(() => res), setHeader: vi.fn() };
  return res;
}
describe('AI allowance enforcement', () => {
  it('fails closed when the budget store is unavailable, including client initialization errors', async () => {
    mocks.rpc.mockRejectedValue(new Error('unavailable'));
    const res = response();
    expect(await requireAIBudget({}, res, { uid: 'owner' }, 4)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(503);
  });
  it('communicates the daily limit and retry time', async () => {
    mocks.rpc.mockResolvedValue({ data: { allowed: false, reason: 'daily', retryAfter: 900 } });
    const res = response();
    expect(await requireAIBudget({}, res, { uid: 'owner' })).toBe(false);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '900');
  });
  it('only skips the second charge for an internal memory symbol', async () => {
    mocks.rpc.mockResolvedValue({ data: { allowed: true } });
    expect(await requireAIBudget({ INTERNAL_JOB: {} }, response(), { uid: 'owner' })).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(await requireAIBudget({ [INTERNAL_JOB]: {} }, response(), { uid: 'owner' })).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
describe('Document inspection', () => {
  it('rejects a PDF extension with HTML bytes, active PDFs and incomplete PDFs', () => {
    for (const text of ['<html>fake</html>', '%PDF-1.4 /JavaScript (alert) %%EOF', '%PDF-1.4 /Encrypt 1 0 R %%EOF', '%PDF-1.4 incomplete']) {
      expect(() => validateFileBytes(Buffer.from(text), 'application/pdf')).toThrow();
    }
    expect(validateFileBytes(Buffer.from('%PDF-1.4\n%%EOF'), 'application/pdf')).toHaveLength(64);
  });
  it('rejects unreasonable image dimensions and validates the whole WebP container size', () => {
    const png = Buffer.alloc(45);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
    png.write('IHDR', 12); png.writeUInt32BE(100000, 16); png.writeUInt32BE(100000, 20); png.write('IEND', 37);
    expect(() => validateFileBytes(png, 'image/png')).toThrow();
    const webp = Buffer.alloc(24); webp.write('RIFF'); webp.write('WEBP', 8); webp.writeUInt32LE(999, 4);
    expect(() => validateFileBytes(webp, 'image/webp')).toThrow();
  });
  it('checks the registered MIME and actual byte size and quarantines mismatches', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { mime: 'application/pdf', size: 999, state: 'pending' } });
    await expect(inspectBlob(new Blob(['%PDF-1.4\n%%EOF']), 'application/pdf', 'owner/file.pdf')).rejects.toMatchObject({ status: 422 });
    expect(mocks.rpc).toHaveBeenLastCalledWith('anchor_record_inspection', expect.objectContaining({ rejected: true }));
  });
  it('reports the absence of antivirus honestly', async () => {
    expect(await scanFile(Buffer.from('sample'))).toEqual({ antivirus: 'not_configured' });
  });
  it.each([['stream: OK\0', null], ['stream: Eicar-Test-Signature FOUND\0', 422], ['bad response', 503]])('handles a private scanner response %s', async (result, status) => {
    const server = net.createServer(socket => { socket.on('data', () => {}); setTimeout(() => socket.end(result), 20); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    vi.stubEnv('CLAMAV_HOST', '127.0.0.1'); vi.stubEnv('CLAMAV_PORT', String(server.address().port)); vi.stubEnv('CLAMAV_TLS', 'false');
    try {
      if (status) await expect(scanFile(Buffer.from('sample'))).rejects.toMatchObject({ status });
      else expect(await scanFile(Buffer.from('sample'))).toEqual({ antivirus: 'passed' });
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});
describe('Authoritative retrieval and durable task dates', () => {
  it('passes the verified owner and a safe text query to retrieval', async () => {
    mocks.rpc.mockResolvedValue({ data: { resources: [], tasks: [] } });
    await loadKnowledge('verified-owner', 'What are my overdue DBMS tasks?');
    expect(mocks.rpc).toHaveBeenCalledWith('anchor_knowledge', expect.objectContaining({ owner_id: 'verified-owner', task_mode: 'overdue', search_query: 'overdue OR dbms OR tasks' }));
  });
  it('saves date-only deadlines in the user time zone and deterministic deduplication IDs', async () => {
    const job = { payload: { resourceId: 'note', timeZone: 'Asia/Calcutta' } };
    const result = { actionItems: [{ title: 'Submit report', deadline: '2026-12-15' }] };
    const [task] = await tasksForJob(job, result);
    expect(new Date(task.data.deadlineMs).toISOString()).toBe('2026-12-15T18:29:59.999Z');
    expect((await tasksForJob(job, result))[0].id).toBe(task.id);
  });
});
