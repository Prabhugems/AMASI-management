-- Add audience_count column to sessions table for hall coordinators to track attendance
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS audience_count INTEGER;
