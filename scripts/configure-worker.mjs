import { randomBytes } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
const input = process.argv[2];
if (!input) throw new Error('Provide the verified production HTTPS origin after deploying the worker endpoints.');
const origin = new URL(input);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('Use an HTTPS origin without credentials, a path or query.');
}
let secret = process.env.ANCHOR_WORKER_SECRET;
if (!secret) {
  secret = randomBytes(32).toString('hex');
  await appendFile('.env.local', '\n# Private scheduled-worker credential; do not expose to the browser.\nANCHOR_WORKER_SECRET=' + secret + '\n');
}
const client = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { error } = await client.rpc('anchor_configure_worker', { base_url: origin.origin, worker_secret: secret });
if (error) { console.error('Could not configure the worker. Check administrative credentials.'); process.exitCode = 1; }
else console.log('Scheduled worker configured for ' + origin.origin + '. Credential retained privately.');
