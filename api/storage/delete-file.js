import { requireAuth } from '../../server/auth.js';
import { getStorageClient } from '../../server/clients.js';
import { validBody, isOwnedPath } from '../../server/validation.js';

export default async function handler(req, res) {
  if (!validBody(req, res)) return;
  const user = await requireAuth(req, res);
  if (!user) return;
  const { storagePath } = req.body;
  if (!isOwnedPath(storagePath, user.uid)) {
    return res.status(403).json({ success: false, error: 'Access denied: Invalid file path.' });
  }
  try {
    const { error } = await getStorageClient().storage.from('anchor-resources').remove([storagePath]);
    if (error) throw new Error('Deletion failed.');
    return res.status(200).json({ success: true });
  } catch {
    return res.status(503).json({ success: false, error: 'File deletion is temporarily unavailable. Please try again.' });
  }
}
