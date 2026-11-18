import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../../server/auth.js';
import { getStorageClient } from '../../server/clients.js';
import { validBody, FILE_EXTENSIONS, MAX_FILE_BYTES } from '../../server/validation.js';

export default async function handler(req, res) {
  if (!validBody(req, res)) return;
  const user = await requireAuth(req, res);
  if (!user) return;
  const { resourceId, fileName, fileType, fileSize } = req.body;
  if (typeof resourceId !== 'string' || !/^[\w-]{1,128}$/.test(resourceId)) {
    return res.status(400).json({ success: false, error: 'A valid resourceId is required.' });
  }
  if (typeof fileName !== 'string' || !FILE_EXTENSIONS[fileType]?.includes(path.extname(fileName).toLowerCase())) {
    return res.status(400).json({ success: false, error: 'File type and extension must match: PDF, JPEG, PNG, or WebP.' });
  }
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_BYTES) {
    return res.status(400).json({ success: false, error: 'File size must be between 1 byte and 20 MB.' });
  }
  try {
    const storagePath = user.uid + '/' + resourceId + '/' + randomUUID() + path.extname(fileName).toLowerCase();
    const { data, error } = await getStorageClient().storage.from('anchor-resources').createSignedUploadUrl(storagePath);
    if (error || !data?.signedUrl) throw new Error('Upload failed.');
    return res.status(200).json({ success: true, data: { signedUrl: data.signedUrl, path: storagePath } });
  } catch {
    return res.status(503).json({ success: false, error: 'File upload is temporarily unavailable. Please try again.' });
  }
}
