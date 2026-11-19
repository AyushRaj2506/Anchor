import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
let supabase = null;
if (url && key) {
  try { supabase = createClient(url, key); } catch { /* Demo remains available. */ }
}
export { supabase };
