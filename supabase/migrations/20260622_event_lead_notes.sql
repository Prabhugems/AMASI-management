-- event_lead_notes: CRM notes on event leads. Referenced by
-- /api/events/[eventId]/leads/[leadId] and .../notes (select + insert), but the
-- table was never present in the DB, so lead notes silently failed. Schema
-- derived from the insert: lead_id, content, type, created_by.

CREATE TABLE IF NOT EXISTS event_lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES event_leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'note',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_lead_notes_lead ON event_lead_notes(lead_id);

ALTER TABLE event_lead_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access event_lead_notes" ON event_lead_notes;
CREATE POLICY "Service role full access event_lead_notes" ON event_lead_notes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
