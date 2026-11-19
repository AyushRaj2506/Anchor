import { getStorageClient } from '../../server/clients.js';
import { requireWorker } from '../../server/worker.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false });
  try {
    if (!await requireWorker(req, res)) return;
    const client = getStorageClient();
    const { data: paths, error } = await client.rpc('anchor_claim_orphans');
    if (error) return res.status(503).json({ success: false });
    if (paths?.length) {
      const removed = await client.storage.from('anchor-resources').remove(paths);
      if (removed.error) return res.status(503).json({ success: false });
      const saved = await client.rpc('anchor_finish_cleanup', { paths });
      if (saved.error) return res.status(503).json({ success: false });
    }
    console.info(JSON.stringify({ event: 'upload_cleanup', removed: paths?.length || 0 }));
    return res.status(200).json({ success: true, removed: paths?.length || 0 });
  } catch {
    console.error(JSON.stringify({ event: 'upload_cleanup_unavailable' }));
    return res.status(503).json({ success: false });
  }
}
