import { getStorageClient } from './clients.js';

export async function requireWorker(req, res) {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers?.authorization || '')?.[1];
  if (!token) { res.status(401).json({ success: false, error: 'Unauthorized.' }); return false; }
  const { data, error } = await getStorageClient().rpc('anchor_validate_worker', { token });
  if (error || data !== true) { res.status(401).json({ success: false, error: 'Unauthorized.' }); return false; }
  return true;
}
