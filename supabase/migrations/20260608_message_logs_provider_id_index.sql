-- Speed up provider-webhook lookups (Qikchat, Resend, etc.) that match on
-- provider_message_id when updating delivery / read status.
CREATE INDEX IF NOT EXISTS idx_message_logs_provider_message_id
  ON message_logs(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
