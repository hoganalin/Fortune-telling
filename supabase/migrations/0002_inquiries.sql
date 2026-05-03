-- Aura · AI 五行 — Q&A thread persistence
--
-- inquiries  Multi-turn follow-up questions tied to a specific reading.
--            Initial Q&A still lives in readings.ai_payload.qa (single event).

CREATE TABLE IF NOT EXISTS inquiries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id  uuid NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  owner_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question    text NOT NULL,
  answer      jsonb NOT NULL,                 -- { zh, en, usage? }
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquiries_reading_idx
  ON inquiries(reading_id, created_at);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inquiries select own"
  ON inquiries FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "inquiries insert own"
  ON inquiries FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "inquiries delete own"
  ON inquiries FOR DELETE
  USING (auth.uid() = owner_id);
