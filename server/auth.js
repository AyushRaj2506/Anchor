import { getAuthClient } from './clients.js';

export async function verifyAuth(req) {
  const header = req.headers?.authorization;
  const token = typeof header === 'string' && /^Bearer\s+(\S+)$/i.exec(header)?.[1];
  if (!token) throw new Error('UNAUTHORIZED');

  let client;
  try { client = getAuthClient(); } catch {
    throw Object.assign(new Error('Authentication service is temporarily unavailable.'), { status: 503 });
  }
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.id) {
    if (error?.status >= 500 || error?.name === 'AuthRetryableFetchError') {
      throw Object.assign(new Error('Authentication service is temporarily unavailable.'), { status: 503 });
    }
    throw new Error('UNAUTHORIZED');
  }
  return { uid: data.user.id, email: data.user.email };
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
