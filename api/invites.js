// POST /api/invites — A creates a synastry invite for one of their readings.
// Auth: caller must send `Authorization: Bearer <JWT>` from a Supabase session.
// Body: { reading_id }
// Returns: { token, invite_url, expires_at }

import crypto from 'node:crypto';
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAllowedReferer(req.headers.referer || req.headers.origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(500).json({ error: 'Server missing Supabase config' });
  }

  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) return res.status(401).json({ error: 'Missing bearer token' });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' });
  const userId = userData.user.id;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { reading_id } = body;
  if (!reading_id) return res.status(400).json({ error: 'Missing reading_id' });

  const { data: reading, error: readingErr } = await admin
    .from('readings')
    .select('id, owner_id')
    .eq('id', reading_id)
    .maybeSingle();
  if (readingErr) return res.status(500).json({ error: readingErr.message });
  if (!reading) return res.status(404).json({ error: 'Reading not found' });
  if (reading.owner_id !== userId) return res.status(403).json({ error: 'Not your reading' });

  const token = crypto.randomBytes(32).toString('base64url');

  const { data: invite, error: inviteErr } = await admin
    .from('synastry_invites')
    .insert({ token, inviter_reading_id: reading_id })
    .select('id, token, expires_at')
    .single();
  if (inviteErr) return res.status(500).json({ error: inviteErr.message });

  const origin = req.headers.origin || '';
  return res.status(200).json({
    token: invite.token,
    invite_url: `${origin}/?invite=${encodeURIComponent(invite.token)}`,
    expires_at: invite.expires_at,
  });
}
