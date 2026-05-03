-- Aura · AI 五行 — initial schema
--
-- profiles            1:1 with auth.users (auto-created via trigger on signup)
-- readings            AI 五行 reading per user
-- synastry_invites    A invites B via a one-shot token
-- synastry_results    AI synastry between A and B

-- ─── tables ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text,
  is_anonymous  boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS readings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  birth_data    jsonb NOT NULL,    -- { name, date, time, location, question }
  element       text NOT NULL,     -- metal | wood | water | fire | earth
  pillars       jsonb,             -- four pillars
  distribution  jsonb,             -- five-element distribution
  ai_payload    jsonb NOT NULL,    -- structured Claude output (lessons / remedies / fortune / analysis)
  language      text DEFAULT 'zh',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS readings_owner_idx
  ON readings(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS synastry_invites (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token                text UNIQUE NOT NULL,                          -- 32-byte CSPRNG, base64url
  inviter_reading_id   uuid NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  invitee_birth_data   jsonb,                                          -- null until B fills
  invitee_owner_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  invitee_reading_id   uuid REFERENCES readings(id) ON DELETE SET NULL,
  status               text NOT NULL DEFAULT 'pending',                -- pending | completed | expired
  expires_at           timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at           timestamptz DEFAULT now(),
  completed_at         timestamptz
);

CREATE INDEX IF NOT EXISTS synastry_invites_inviter_idx ON synastry_invites(inviter_reading_id);
CREATE INDEX IF NOT EXISTS synastry_invites_token_idx ON synastry_invites(token);

CREATE TABLE IF NOT EXISTS synastry_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id   uuid UNIQUE NOT NULL REFERENCES synastry_invites(id) ON DELETE CASCADE,
  ai_payload  jsonb NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- ─── auto-create profile when a new auth user is born ───────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, is_anonymous)
  VALUES (NEW.id, COALESCE(NEW.is_anonymous, true));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: any auth.users that were created before this trigger existed
-- still need a profiles row, otherwise FK constraints from readings will fail.
INSERT INTO public.profiles (id, is_anonymous)
SELECT u.id, COALESCE(u.is_anonymous, true)
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- ─── enable RLS ─────────────────────────────────────────────────────
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE synastry_invites  ENABLE ROW LEVEL SECURITY;
ALTER TABLE synastry_results  ENABLE ROW LEVEL SECURITY;

-- ─── RLS policies ───────────────────────────────────────────────────
-- profiles: own only
CREATE POLICY "profiles select own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles update own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- readings: own only
CREATE POLICY "readings select own"
  ON readings FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "readings insert own"
  ON readings FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "readings delete own"
  ON readings FOR DELETE
  USING (auth.uid() = owner_id);

-- synastry_invites:
--   inviter (via reading owner) and invitee (after claiming) can SELECT
--   inviter creates the invite
--   public token-based access for unauthenticated B happens via service-role API endpoint, NOT through RLS
CREATE POLICY "synastry_invites select by parties"
  ON synastry_invites FOR SELECT
  USING (
    auth.uid() = invitee_owner_id
    OR auth.uid() = (SELECT owner_id FROM readings WHERE id = synastry_invites.inviter_reading_id)
  );

CREATE POLICY "synastry_invites insert by inviter"
  ON synastry_invites FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT owner_id FROM readings WHERE id = synastry_invites.inviter_reading_id)
  );

-- synastry_results: either party can read
CREATE POLICY "synastry_results select by parties"
  ON synastry_results FOR SELECT
  USING (
    auth.uid() = (SELECT invitee_owner_id FROM synastry_invites WHERE id = synastry_results.invite_id)
    OR auth.uid() = (
      SELECT r.owner_id
      FROM readings r
      JOIN synastry_invites i ON i.inviter_reading_id = r.id
      WHERE i.id = synastry_results.invite_id
    )
  );

-- INSERTs into synastry_results happen via service-role from /api/invites/:token/complete
