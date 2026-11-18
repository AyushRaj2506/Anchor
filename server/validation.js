export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const FILE_EXTENSIONS = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

export function isOwnedPath(storagePath, uid) {
  if (typeof storagePath !== 'string' || !storagePath.startsWith(`${uid}/`)) return false;
  // Reject ambiguous paths before handing them to another HTTP client.
  return storagePath.length <= 1024 && !/[\\%?#]/.test(storagePath) && [...storagePath].every(character => character.charCodeAt(0) >= 32)
    && storagePath.split('/').every(segment => segment && segment !== '.' && segment !== '..');
}

export function validBody(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return false;
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ success: false, error: 'A JSON object is required.' });
    return false;
  }
  return true;
}
