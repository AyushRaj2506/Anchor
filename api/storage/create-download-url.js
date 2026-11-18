import { requireAuth } from '../../server/auth.js';
import { getStorageClient } from '../../server/clients.js';
import { validBody, isOwnedPath } from '../../server/validation.js';

export default async function handler(req, res) {
  if (!validBody(req, res)) return;
  const user = await requireAuth(req, res);
  if (!user) return;
  const { storagePath, download = false } = req.body;
  if (!isOwnedPath(storagePath, user.uid)) {
    return res.status(403).json({ success: false, error: 'Access denied: Invalid file path.' });
  }
  try {
    const { data, error } = await getStorageClient().storage.from('anchor-resources').createSignedUrl(storagePath, 900, { download: download === true });
    if (error || !data?.signedUrl) throw new Error('Download failed.');
    return res.status(200).json({ success: true, data: { signedUrl: data.signedUrl } });
  } catch {
    return res.status(503).json({ success: false, error: 'File preview is temporarily unavailable. Please try again.' });
  }
}
