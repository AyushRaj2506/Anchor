import path from 'node:path';
import { inspectBlob } from '../../server/inspection.js';
import { FILE_EXTENSIONS } from '../../server/validation.js';
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
    const mime = Object.entries(FILE_EXTENSIONS).find(([, extensions]) => extensions.includes(path.extname(storagePath).toLowerCase()))?.[0];
    const file = await getStorageClient().storage.from('anchor-resources').download(storagePath);
    if (file.error || !file.data) throw new Error('Download failed.');
    await inspectBlob(file.data, mime, storagePath);
    const { data, error } = await getStorageClient().storage.from('anchor-resources').createSignedUrl(storagePath, 900, { download: download === true });
    if (error || !data?.signedUrl) throw new Error('Download failed.');
    return res.status(200).json({ success: true, data: { signedUrl: data.signedUrl } });
  } catch (error) {
    if ([413, 422].includes(error.status)) return res.status(error.status).json({ success: false, error: error.message });
    return res.status(503).json({ success: false, error: 'File preview is temporarily unavailable. Please try again.' });
  }
}
