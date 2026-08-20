import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '../utils/auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // 1. Authenticate user
    let decodedToken;
    try {
      decodedToken = await verifyAuth(req);
    } catch (authErr) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing token.' });
    }

    const { uid } = decodedToken;
    const { storagePath } = req.body;

    if (!storagePath || typeof storagePath !== 'string') {
      return res.status(400).json({ success: false, error: 'storagePath is required and must be a string.' });
    }

    // 2. Security Check: Ensure user only downloads files from their own folder
    const prefix = `${uid}/`;
    if (!storagePath.startsWith(prefix)) {
      console.warn(`User ${uid} attempted to access unauthorized storage path: ${storagePath}`);
      return res.status(403).json({ success: false, error: 'Access denied: Unauthorized file path.' });
    }

    // 3. Generate time-limited download URL (valid for 15 minutes = 900 seconds)
    const { data, error } = await supabase.storage
      .from('anchor-resources')
      .createSignedUrl(storagePath, 900);

    if (error) {
      console.error('Supabase signed download URL error:', error);
      return res.status(500).json({ success: false, error: 'Failed to generate download link.' });
    }

    return res.status(200).json({
      success: true,
      data: {
        signedUrl: data.signedUrl
      }
    });

  } catch (err) {
    console.error('Download URL API error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}
