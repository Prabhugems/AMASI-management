-- help_request_replies: referenced by /api/help-request (admin list embeds
-- `help_request_replies(id)`) and /api/help-request/replies (threaded replies),
-- but the table was never present in the DB — so the admin help-requests list
-- 500'd and showed nothing. This formalizes the shape.

CREATE TABLE IF NOT EXISTS help_request_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  help_request_id UUID NOT NULL REFERENCES help_requests(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,            -- 'admin' | 'delegate'
  sender_name TEXT,
  sender_email TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_request_replies_request ON help_request_replies(help_request_id);

ALTER TABLE help_request_replies ENABLE ROW LEVEL SECURITY;
