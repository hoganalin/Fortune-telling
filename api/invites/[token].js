// GET  /api/invites/:token  — public read: returns minimal inviter info for B's landing page
// POST /api/invites/:token  — B (auth) marks invite complete + stores synastry result
//
// GET returns: { status, expires_at, inviter_element, inviter_name }
// POST body:   { invitee_reading_id, synastry_payload }
// POST returns: { ok: true }

import { createClient } from '@supabase/supabase-js';

const ALLOWED_REFERERS = (process.env.ALLOWED_REFERERS || 'http://localhost:3000,http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);
function isAllowedReferer(r) {
  if (!r) return false;
  // Dev convenience: any localhost port is allowed (vercel dev / vite dev / etc).
  if (/^https?:\/\/localhost(:\d+)?(\/|$)/.test(r)) return true;
  return ALLOWED_REFERERS.some((a) => r.startsWith(a));
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

async function handleGet(req, res, token) {
  const admin = adminClient();
  const { data, error } = await admin
    .from('synastry_invites')
    .select('id, status, expires_at, inviter_reading_id')
    .eq('token', token)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Invite not found' });

  if (new Date(data.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: 'Invite expired', status: 'expired' });
  }

  const { data: reading, error: readingErr } = await admin
    .from('readings')
    .select('element, birth_data')
    .eq('id', data.inviter_reading_id)
    .maybeSingle();
  if (readingErr) return res.status(500).json({ error: readingErr.message });
  if (!reading) return res.status(404).json({ error: 'Inviter reading not found' });

  // Minimum birth data for B to run client-side synastry math (computeFourPillars + element distribution).
  // We deliberately do NOT expose A's location, question, or AI payload — those stay private.
  const bd = reading.birth_data || {};
  return res.status(200).json({
    status: data.status,
    expires_at: data.expires_at,
    inviter_element: reading.element,
    inviter_name: bd.name ?? null,
    inviter_birth: { name: bd.name ?? null, date: bd.date ?? null, time: bd.time ?? null },
  });
}

async function handlePost(req, res, token) {
  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) return res.status(401).json({ error: 'Missing bearer token' });

  const admin = adminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' });
  const userId = userData.user.id;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { invitee_reading_id, synastry_payload } = body;
  if (!invitee_reading_id || !synastry_payload) {
    return res.status(400).json({ error: 'Missing invitee_reading_id or synastry_payload' });
  }

  // 1. Look up invite
  const { data: invite, error: inviteErr } = await admin
    .from('synastry_invites')
    .select('id, status, expires_at, inviter_reading_id')
    .eq('token', token)
    .maybeSingle();
  if (inviteErr) return res.status(500).json({ error: inviteErr.message });
  if (!invite) return res.status(404).json({ error: 'Invite not found' });
  if (invite.status !== 'pending') return res.status(409).json({ error: 'Invite already completed or expired' });
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: 'Invite expired' });
  }

  // 2. Verify B's reading belongs to caller
  const { data: bReading, error: bReadingErr } = await admin
    .from('readings')
    .select('id, owner_id, birth_data')
    .eq('id', invitee_reading_id)
    .maybeSingle();
  if (bReadingErr) return res.status(500).json({ error: bReadingErr.message });
  if (!bReading) return res.status(404).json({ error: 'Invitee reading not found' });
  if (bReading.owner_id !== userId) return res.status(403).json({ error: 'Not your reading' });

  // 3. Update invite + insert synastry_results in parallel
  const [updateRes, insertRes] = await Promise.all([
    admin.from('synastry_invites').update({
      invitee_owner_id: userId,
      invitee_reading_id,
      invitee_birth_data: bReading.birth_data ?? null,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', invite.id),
    admin.from('synastry_results').insert({
      invite_id: invite.id,
      ai_payload: synastry_payload,
    }),
  ]);
  if (updateRes.error) return res.status(500).json({ error: updateRes.error.message });
  if (insertRes.error) return res.status(500).json({ error: insertRes.error.message });

  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  if (!isAllowedReferer(req.headers.referer || req.headers.origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(500).json({ error: 'Server missing Supabase config' });
  }

  const token = req.query?.token;
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Missing token' });

  if (req.method === 'GET') return handleGet(req, res, token);
  if (req.method === 'POST') return handlePost(req, res, token);

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
