import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '../utils/auth.js';
import path from 'path';

let supabase;

const initSupabase = () => {
  if (supabase) return supabase;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase URL and Service Role Key are required.');
  }
  supabase = createClient(url, key);
  return supabase;
};

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let supabaseClient;
    try {
      supabaseClient = initSupabase();
    } catch (envErr) {
      console.error('Supabase init error:', envErr);
      return res.status(500).json({ success: false, error: 'Server misconfiguration: Missing Supabase environment variables.' });
    }

    // 1. Authenticate user
    let decodedToken;
    try {
      decodedToken = await verifyAuth(req);
    } catch (authErr) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing token.' });
    }

    const { uid } = decodedToken;
    const { resourceId, fileName, fileType } = req.body;

    // 2. Validate Inputs
    if (!resourceId || typeof resourceId !== 'string') {
      return res.status(400).json({ success: false, error: 'resourceId is required and must be a string.' });
    }

    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({ success: false, error: 'fileName is required and must be a string.' });
    }

    if (!fileType || typeof fileType !== 'string') {
      return res.status(400).json({ success: false, error: 'fileType is required and must be a string.' });
    }

    // Validate MIME types
    if (!ALLOWED_MIME_TYPES.includes(fileType)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid file type: ${fileType}. Allowed types: PDF, JPEG, PNG, WebP.` 
      });
    }

    // 3. Sanitize and generate unique safe filename
    const fileExtension = path.extname(fileName).toLowerCase();
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({ success: false, error: 'Invalid file extension.' });
    }

    // Path structure: anchor-resources/<firebaseUid>/<resourceId>/<safeFileName>
    // safeFileName: resourceId-timestamp.ext
    const safeFileName = `${resourceId}-${Date.now()}${fileExtension}`;
    const storagePath = `${uid}/${resourceId}/${safeFileName}`;

    // 4. Generate signed upload URL via Supabase Storage
    const { data, error } = await supabaseClient.storage
      .from('anchor-resources')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('Supabase signed URL error:', error);
      return res.status(500).json({ success: false, error: 'Failed to generate upload URL from storage provider.' });
    }

    return res.status(200).json({
      success: true,
      data: {
        signedUrl: data.signedUrl,
        token: data.token,
        path: storagePath
      }
    });

  } catch (err) {
    console.error('Upload URL API error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}
