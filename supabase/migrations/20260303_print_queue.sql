-- Add print queue support to print_jobs table
-- Allows iPad kiosk (cloud) to queue jobs, and local print agent to pick them up

ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS zpl_data TEXT;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS badge_html TEXT;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS registration_data JSONB;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS agent_id VARCHAR(255);

-- Index for polling queued jobs efficiently
CREATE INDEX IF NOT EXISTS idx_print_jobs_queued
ON print_jobs(print_station_id, status) WHERE status = 'queued';
