-- help_requests was created out-of-band and never got the `priority` and
-- `assigned_to` columns that the app depends on:
--   - /api/help-request (GET filters by, PATCH writes) priority + assigned_to
--   - the admin help-requests page (priority selector + assignee dropdown)
-- Without these columns, every priority change / assignment PATCH errors with
-- "column does not exist" -> 500 -> the UI shows "Failed to update", and the
-- list always renders priority as the "medium" fallback with no assignee.
--
-- priority:    'low' | 'medium' | 'high' | 'urgent' (default 'medium')
-- assigned_to: team_members(id), nullable; null on member removal.

ALTER TABLE help_requests
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_help_requests_assigned_to ON help_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_help_requests_event_status ON help_requests(event_id, status);
