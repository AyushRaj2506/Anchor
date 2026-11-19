import { randomUUID } from 'node:crypto';
import { requireAuth } from '../../server/auth.js';
import { getStorageClient } from '../../server/clients.js';
import { validBody, isOwnedPath, FILE_EXTENSIONS } from '../../server/validation.js';

export default async function handler(req, res) {
  if (!validBody(req, res)) return;
  const user = await requireAuth(req, res);
  if (!user) return;
  const { kind, requestId = randomUUID() } = req.body;
  let { payload } = req.body;
  if (!['text', 'file', 'url'].includes(kind) || !payload || typeof payload !== 'object' || Array.isArray(payload)
    || JSON.stringify(payload).length > 200000 || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(requestId)) {
    return res.status(400).json({ success: false, error: 'Invalid analysis request.' });
  }
  if (kind === 'file' && (!isOwnedPath(payload.storagePath, user.uid) || !FILE_EXTENSIONS[payload.fileType])) {
    return res.status(403).json({ success: false, error: 'Invalid file access.' });
  }
  if (kind === 'url' && (typeof payload.url !== 'string' || payload.url.length > 2048)) {
    return res.status(400).json({ success: false, error: 'A valid URL is required.' });
  }
  if (kind === 'text' && (typeof payload.text !== 'string' && (!payload.resource || typeof payload.resource !== 'object'))) {
    return res.status(400).json({ success: false, error: 'Resource text is required.' });
  }
  try {
    // Stored resources are authoritative, including file paths and source text.
    if (payload.resourceId) {
      const record = await getStorageClient().from('resources').select('data').eq('user_id', user.uid).eq('id', payload.resourceId).maybeSingle();
      if (record.error) throw record.error;
      if (!record.data) return res.status(404).json({ success: false, error: 'Resource not found.' });
      const source = record.data.data;
      const snapshot = await getStorageClient().rpc('anchor_source_snapshot', { document: source });
      if (snapshot.error) throw snapshot.error;
      const fingerprint = await getStorageClient().rpc('anchor_source_fingerprint', { document: source });
      if (fingerprint.error) throw fingerprint.error;
      const canonical = kind === 'file' ? { storagePath: source.storagePath, fileType: source.fileType }
        : kind === 'url' ? { url: source.sourceUrl || source.url, title: source.title } : { resource: snapshot.data };
      payload = { ...canonical, resourceId: payload.resourceId, source_fingerprint: fingerprint.data, timeZone: payload.timeZone || 'UTC' };
      if (kind === 'file' && (!isOwnedPath(payload.storagePath, user.uid) || !FILE_EXTENSIONS[payload.fileType])) {
        return res.status(400).json({ success: false, error: 'Resource has no supported file.' });
      }
    } else {
      payload = kind === 'text' ? { text: payload.text, resource: payload.resource } : kind === 'file'
        ? { storagePath: payload.storagePath, fileType: payload.fileType } : { url: payload.url, title: payload.title };
    }
    const { data, error } = await getStorageClient().rpc('anchor_enqueue_job', {
      owner_id: user.uid, job_kind: kind, job_payload: payload, request_key: requestId, credit_cost: kind === 'file' ? 4 : kind === 'url' ? 2 : 1,
    });
    if (error) throw error;
    if (!data.id) return res.status(data.status || 503).json({ success: false, error: data.error, retryAfter: data.retryAfter || 60 });
    return res.status(202).json({ success: true, data: { id: data.id, status: 'queued' } });
  } catch { return res.status(503).json({ success: false, error: 'Analysis could not be queued. Please retry.' }); }
}
