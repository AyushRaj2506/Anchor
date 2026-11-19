import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
try {
  const client = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc('anchor_health');
  if (error) throw error;
  console.log(JSON.stringify(data, null, 2));
  if (!data.workerConfigured || data.stalled > 0) process.exitCode = 1;
} catch { console.error('Could not read production queue health. Check server credentials and connectivity.'); process.exitCode = 1; }
