// ─── Supabase Client (Server-Side) ────────────────────────────
// Uses the service role key — never expose this in the browser.
// This client bypasses Row Level Security and can do all writes.
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl  = process.env.SUPABASE_URL;
const supabaseKey  = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[Supabase] SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env\n' +
    '  Find them at: Supabase Dashboard → Project Settings → API'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

console.log('[Supabase] ✅ Client initialised');
module.exports = supabase;
