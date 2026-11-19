import { getStorageClient } from './clients.js';

export const INTERNAL_JOB = Symbol('verified analysis job');

export async function requireAIBudget(req, res, user, cost = 1) {
  if (req[INTERNAL_JOB]) return true; // Credits were reserved at enqueue time.
  try {
    const { data, error } = await getStorageClient().rpc('anchor_consume_ai', { owner_id: user.uid, cost });
    if (error) {
      res.status(503).json({ success: false, error: 'AI usage checks are temporarily unavailable. Please try again.' });
      return false;
    }
    if (!data?.allowed) {
      res.setHeader?.('Retry-After', String(data?.retryAfter || 60));
      res.status(429).json({ success: false, error: data?.reason === 'daily'
        ? 'Your daily AI allowance has been reached. Please try again tomorrow.'
        : 'Too many AI requests. Please wait a minute and try again.', retryAfter: data?.retryAfter || 60 });
      return false;
    }
    return true;
  } catch {
    res.status(503).json({ success: false, error: 'AI usage checks are temporarily unavailable. Please try again.' });
    return false;
  }
}
