import analyzeText from '../ai/analyze.js';
import analyzeFile from '../ai/analyze-resource.js';
import analyzeUrl from '../ai/analyze-url.js';
import { requireWorker } from '../../server/worker.js';
import { getStorageClient } from '../../server/clients.js';
import { INTERNAL_JOB } from '../../server/usage.js';
import { tasksForJob } from '../../server/job-tasks.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false });
  try {
    if (!await requireWorker(req, res)) return;
    const client = getStorageClient();
    const { data, error } = await client.rpc('anchor_claim_job');
    if (error) return res.status(503).json({ success: false });
    const job = data?.[0];
    if (!job) return res.status(200).json({ success: true, idle: true });
    const started = Date.now();
    let code = 500, body = { error: 'Analysis was interrupted. Please retry.' };
    const response = { status(value) { code = value; return response; }, json(value) { body = value; return response; }, setHeader() {} };
    try {
      await ({ text: analyzeText, file: analyzeFile, url: analyzeUrl })[job.kind]({ method: 'POST', headers: {}, body: job.payload, [INTERNAL_JOB]: job }, response);
    } catch { code = 503; }
    const retry = [429, 503, 504].includes(code) && job.attempts < 3;
    const changes = code === 200 && body.success ? { status: 'succeeded', result: body.data, error: null }
      : { status: retry ? 'queued' : 'failed', result: null, error: body.error || 'Analysis failed. Please retry.' };
    const saved = await client.rpc('anchor_finish_job', {
      job_id: job.id, worker_lease: job.lease_token, output: changes.result || null,
      generated_tasks: changes.result ? await tasksForJob(job, changes.result) : [],
      failure: changes.error, retry,
    });
    // Structured operational metadata only; no user text, paths, tokens or output.
    const accepted = !saved.error && saved.data === true;
    console.info(JSON.stringify({ event: 'analysis_job', kind: job.kind, providerOutcome: changes.status, saved: accepted, attempt: job.attempts, elapsedMs: Date.now() - started }));
    return res.status(accepted ? 200 : 503).json({ success: accepted, completed: accepted });
  } catch {
    console.error(JSON.stringify({ event: 'analysis_worker_unavailable' }));
    return res.status(503).json({ success: false, error: 'Analysis worker is temporarily unavailable.' });
  }
}
