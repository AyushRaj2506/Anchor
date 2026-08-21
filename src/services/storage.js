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
    body: JSON.stringify(payload)
  });

  let result;
  try {
    result = await response.json();
  } catch (err) {
    throw new Error(`Server returned an unexpected response. Status: ${response.status}`);
  }

  if (!response.ok || !result.success) {
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
export function uploadFile(file, resourceId, idToken, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      onProgress(0); // init progress

      // 1. Ask Vercel backend to authorize upload and generate signed URL
      const { signedUrl, path } = await fetchStorage('/api/storage/create-upload-url', {
        resourceId,
        fileName: file.name,
        fileType: file.type
      }, idToken);

      // 2. Perform direct upload to Supabase via XMLHttpRequest to support progress tracking
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', file.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          resolve(path); // Success: return storagePath
        } else {
          reject(new Error(`Storage provider returned status ${xhr.status} during upload.`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error occurred during upload.'));
      };

      xhr.send(file);

    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Fetches a time-limited signed URL to view/download a private file.
 * 
 * @param {string} storagePath - The full path of the file in the bucket
 * @param {string} idToken - Firebase ID token
 * @returns {Promise<string>} - Resolves with the signed download URL
 */
export async function getDownloadUrl(storagePath, idToken) {
  const result = await fetchStorage('/api/storage/create-download-url', { storagePath }, idToken);
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
