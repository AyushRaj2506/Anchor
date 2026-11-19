import { requireAuth } from '../../server/auth.js';
import { getStorageClient } from '../../server/clients.js';
import { validBody } from '../../server/validation.js';

export default async function handler(req, res) {
  if (!validBody(req, res)) return;
  const user = await requireAuth(req, res);
  if (!user) return;
  if (typeof req.body.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(req.body.id)) return res.status(400).json({ success: false, error: 'Invalid analysis ID.' });
  try {
    const { data, error } = await getStorageClient().from('ai_jobs').select('id,status,result,error,attempts,created_at,updated_at')
      .eq('id', req.body.id).eq('user_id', user.uid).maybeSingle();
    if (error) return res.status(503).json({ success: false, error: 'Analysis status is unavailable.' });
    if (!data) return res.status(404).json({ success: false, error: 'Analysis not found.' });
    return res.status(200).json({ success: true, data });
  } catch { return res.status(503).json({ success: false, error: 'Analysis status is unavailable.' }); }
}
