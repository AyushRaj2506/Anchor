// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), analyze: vi.fn() }));
vi.mock('../../../server/clients.js', () => ({ getStorageClient: () => ({ rpc: mocks.rpc }) }));
vi.mock('../../../api/ai/analyze.js', () => ({ default: mocks.analyze }));
vi.mock('../../../api/ai/analyze-resource.js', () => ({ default: mocks.analyze }));
vi.mock('../../../api/ai/analyze-url.js', () => ({ default: mocks.analyze }));
import run from '../../../api/jobs/run.js';
import { INTERNAL_JOB } from '../../../server/usage.js';
const job = { id: 'job', user_id: 'owner', kind: 'text', payload: { text: 'Synthetic' }, lease_token: 'lease', attempts: 1 };
async function call(token = 'worker-secret') {
  let code, body;
  const res = { status(value) { code = value; return res; }, json(value) { body = value; return res; } };
  await run({ method: 'POST', headers: { authorization: 'Bearer ' + token } }, res);
  return { code, body };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockImplementation(async name => ({ data: name === 'anchor_validate_worker' || name === 'anchor_finish_job' ? true : [job], error: null }));
  mocks.analyze.mockImplementation(async (_req, res) => res.status(200).json({ success: true, data: { summary: 'Saved', actionItems: [] } }));
});
describe('Durable worker boundaries', () => {
  it('rejects an invalid worker credential before claiming any user work', async () => {
    mocks.rpc.mockResolvedValue({ data: false });
    expect((await call('invalid')).code).toBe(401);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it('passes only the claimed owner through the internal auth boundary and awaits durable completion', async () => {
    expect((await call()).code).toBe(200);
    expect(mocks.analyze.mock.calls[0][0][INTERNAL_JOB]).toEqual(job);
    expect(mocks.rpc).toHaveBeenLastCalledWith('anchor_finish_job', expect.objectContaining({ job_id: 'job', worker_lease: 'lease', output: { summary: 'Saved', actionItems: [] }, generated_tasks: [] }));
  });
  it('does not claim success when a stale lease prevents saving', async () => {
    mocks.rpc.mockImplementation(async name => ({ data: name === 'anchor_finish_job' ? false : name === 'anchor_validate_worker' ? true : [job] }));
    expect((await call()).code).toBe(503);
  });
  it('requeues a transient provider failure with the attempt cap enforced in the database', async () => {
    mocks.analyze.mockImplementation(async (_req, res) => res.status(503).json({ success: false, error: 'Temporary failure' }));
    await call();
    expect(mocks.rpc).toHaveBeenLastCalledWith('anchor_finish_job', expect.objectContaining({ output: null, retry: true, failure: 'Temporary failure' }));
  });
});
