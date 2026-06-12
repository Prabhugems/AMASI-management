-- Phase B: submit idempotency.
--
-- Caches responses for public write endpoints keyed by a caller-supplied
-- Idempotency-Key header (per Stripe pattern). The (endpoint, key) PK
-- enforces leader election via INSERT race; the leader commits the
-- response on success, followers read the cached body.
--
-- Validation failures do NOT populate this table — only the insert path
-- claims a row, so a failed attempt can be cleanly retried.

CREATE TABLE IF NOT EXISTS submission_idempotency (
  endpoint        TEXT NOT NULL,
  key             TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'processing',  -- 'processing' | 'done'
  request_hash    TEXT,                                -- sha256 of canonical request body
  response_status INT,
  response_body   JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  PRIMARY KEY (endpoint, key)
);

CREATE INDEX IF NOT EXISTS idx_submission_idempotency_expires
  ON submission_idempotency(expires_at);

ALTER TABLE submission_idempotency ENABLE ROW LEVEL SECURITY;
-- No public policies; admin client bypasses RLS.

COMMENT ON TABLE submission_idempotency IS
  'Idempotency-Key response cache for public write endpoints. Drained by TTL.';
