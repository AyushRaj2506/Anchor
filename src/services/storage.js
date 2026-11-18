/**
 * storage.js
 *
 * Frontend service to authorize, upload, download, and delete
 * private files (PDFs and Images) using Supabase Storage.
 * Firebase ID tokens are passed as Bearer authorization.
 */

/**
 * Helper to fetch from Vercel storage API with Bearer token.
 */
async function fetchStorage(endpoint, payload, idToken) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000)
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Server returned an unexpected response. Status: ${response.status}`);
  }

  if (!response.ok || !result?.success) {
    throw new Error(result.error || `Request failed with status ${response.status}`);
  }
  return result.data || result;
}

/**
 * Handles signed URL upload directly to Supabase with progress tracking.
 * 
 * @param {File} file - Browser File object
 * @param {string} resourceId - Unique resource ID
 * @param {string} idToken - Firebase ID token
 * @param {Function} onProgress - Progress callback (percent 0-100)
 * @returns {Promise<string>} - Resolves with the storagePath on success
 */
export async function uploadFile(file, resourceId, idToken, onProgress = () => {}) {
  onProgress(0);
  const { signedUrl, path } = await fetchStorage('/api/storage/create-upload-url', {
    resourceId, fileName: file.name, fileType: file.type, fileSize: file.size,
  }, idToken);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.timeout = 120000;
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(path); }
      else reject(new Error('The file could not be uploaded. Please try again.'));
    };
    xhr.onerror = () => reject(new Error('Network error occurred during upload.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Please try again.'));
    xhr.onabort = () => reject(new Error('Upload was cancelled.'));
    xhr.send(file);
  });
}

/**
 * Fetches a time-limited signed URL to view/download a private file.
 * 
 * @param {string} storagePath - The full path of the file in the bucket
 * @param {string} idToken - Firebase ID token
 * @returns {Promise<string>} - Resolves with the signed download URL
 */
export async function getDownloadUrl(storagePath, idToken, download = false) {
  const result = await fetchStorage('/api/storage/create-download-url', { storagePath, download }, idToken);
  return result.signedUrl;
}

/**
 * Deletes a file from Supabase storage.
 * 
 * @param {string} storagePath - The full path of the file in the bucket
 * @param {string} idToken - Firebase ID token
 * @returns {Promise<void>}
 */
export async function deleteFile(storagePath, idToken) {
  await fetchStorage('/api/storage/delete-file', { storagePath }, idToken);
}
