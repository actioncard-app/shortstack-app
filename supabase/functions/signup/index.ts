import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const username = String(body.username ?? '').trim().toLowerCase();
  const display_name = String(body.display_name ?? '').trim().slice(0, 50);
  if (body.age_18 !== true) return json({ error: 'You must be 18 or older to join.' }, 400);
  if (body.terms !== true) return json({ error: 'Please accept the community rules and terms.' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Enter a valid email.' }, 400);
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return json({ error: 'Username: 3-24 letters, numbers or _.' }, 400);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: taken } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  if (taken) return json({ error: 'That username is taken.' }, 409);
  const { error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { username, display_name: display_name || username, age_18: 'true', terms: 'true' },
  });
  if (error) return json({ error: /already/i.test(error.message) ? 'An account with that email already exists.' : error.message }, 400);
  return json({ ok: true });
});
