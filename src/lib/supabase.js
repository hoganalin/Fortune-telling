// Supabase client + anonymous-auth hook + reading helpers.
// If VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing, every export
// degrades to a no-op so the app keeps working in pre-setup environments.

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(URL && ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(URL, ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'aura-auth',
        detectSessionInUrl: false,
      },
    })
  : null;

// useAnonymousAuth — ensures a Supabase session exists on mount.
// Returns { user, loading, error }. If Supabase is not configured, returns user=null, loading=false.
export function useAnonymousAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    async function ensureSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          if (!cancelled) {
            setUser(session.user);
            setLoading(false);
          }
          return;
        }
        const { data, error: signInError } = await supabase.auth.signInAnonymously();
        if (cancelled) return;
        if (signInError) {
          setError(signInError);
          setLoading(false);
          return;
        }
        setUser(data.user ?? null);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e);
          setLoading(false);
        }
      }
    }

    ensureSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  return { user, loading, error };
}

// saveReading — insert a reading row for the current user.
// Silently no-ops if Supabase isn't configured or there's no session.
export async function saveReading({ userId, birthData, element, pillars, distribution, aiPayload, language = 'zh' }) {
  if (!supabase || !userId) return { data: null, error: null };
  const { data, error } = await supabase
    .from('readings')
    .insert({
      owner_id: userId,
      birth_data: birthData,
      element,
      pillars: pillars ?? null,
      distribution: distribution ?? null,
      ai_payload: aiPayload,
      language,
    })
    .select('id, created_at')
    .single();
  return { data, error };
}

// loadReadings — fetch the current user's readings (most recent first).
export async function loadReadings({ userId, limit = 24 }) {
  if (!supabase || !userId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('readings')
    .select('id, birth_data, element, pillars, distribution, ai_payload, language, created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: data ?? [], error };
}

// Returns the current session's access token (JWT) for Authorization headers.
async function getAccessToken() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// createInvite — A asks the server to mint a token for a given reading.
// Returns { token, invite_url, expires_at } or throws on error.
export async function createInvite({ readingId }) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not signed in');
  const resp = await fetch('/api/invites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reading_id: readingId }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.error || `Invite create failed (${resp.status})`);
  return json;
}

// getInviteInfo — public lookup, no auth required.
// Returns { status, expires_at, inviter_element, inviter_name } or null on 404.
export async function getInviteInfo(token) {
  const resp = await fetch(`/api/invites/${encodeURIComponent(token)}`);
  if (resp.status === 404) return null;
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.error || `Invite lookup failed (${resp.status})`);
  return json;
}

// completeInvite — B finalises the invite; server marks invite completed and stores synastry_results.
export async function completeInvite({ token, inviteeReadingId, synastryPayload }) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Not signed in');
  const resp = await fetch(`/api/invites/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      invitee_reading_id: inviteeReadingId,
      synastry_payload: synastryPayload,
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.error || `Invite complete failed (${resp.status})`);
  return json;
}

// saveInquiry — persist a follow-up Q&A row tied to a reading.
export async function saveInquiry({ userId, readingId, question, answer }) {
  if (!supabase || !userId || !readingId) return { data: null, error: null };
  const { data, error } = await supabase
    .from('inquiries')
    .insert({ owner_id: userId, reading_id: readingId, question, answer })
    .select('id, question, answer, created_at')
    .single();
  return { data, error };
}

// loadInquiries — fetch the conversation thread for a given reading, oldest first.
export async function loadInquiries({ readingId }) {
  if (!supabase || !readingId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, question, answer, created_at')
    .eq('reading_id', readingId)
    .order('created_at', { ascending: true });
  return { data: data ?? [], error };
}

// postInquiry — call the inquiry API endpoint with auth + history. Returns { answer, _usage }.
export async function postInquiry({ readingId, question, history }) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Not signed in');
  const resp = await fetch('/api/inquiry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ reading_id: readingId, question, history: history ?? [] }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.error || `Inquiry failed (${resp.status})`);
  return json;
}
