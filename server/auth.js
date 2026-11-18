import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export async function verifyAuth(req) {
  const header = req.headers?.authorization;
  const token = typeof header === 'string' && /^Bearer\s+(\S+)$/i.exec(header)?.[1];
  if (!token) throw new Error('UNAUTHORIZED');

  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      const error = new Error('Authentication service is temporarily unavailable.');
      error.status = 503;
      throw error;
    }
    try {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } catch {
      const error = new Error('Authentication service is temporarily unavailable.');
      error.status = 503;
      throw error;
    }
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    if (!decoded?.uid) throw new Error('UNAUTHORIZED');
    return decoded;
  } catch {
    throw new Error('UNAUTHORIZED');
  }
}

export async function requireAuth(req, res) {
  try {
    return await verifyAuth(req);
  } catch (error) {
    res.status(error.status || 401).json({
      success: false,
      error: error.status === 503 ? error.message : 'Please sign in to continue.',
    });
    return null;
  }
}
