import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
// Handle ESM/CJS interop wrapper for firebase-admin
const firebaseAdmin = admin.default || admin;

// Initialize Firebase Admin once using service account credentials.
// Compatible with Vercel serverless.
if (!firebaseAdmin.apps || !firebaseAdmin.apps.length) {
  // Replace escaped newlines in the private key
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  try {
    const cert = firebaseAdmin.credential ? firebaseAdmin.credential.cert : firebaseAdmin.cert;
    firebaseAdmin.initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'anchor-824c4',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  } catch (error) {
    console.error('Firebase Admin initialization failed:', error.message);
  }
}

/**
 * Extracts and verifies the Firebase Authorization Bearer token from the request.
 * Returns the decoded token containing the `uid`.
 * Throws 401 errors for unauthorized/missing credentials.
 */
export async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    if (!decodedToken || !decodedToken.uid) {
      throw new Error('UNAUTHORIZED');
    }
    return decodedToken;
  } catch (err) {
    console.error('ID token verification failed:', err.message);
    throw new Error('UNAUTHORIZED');
  }
}
