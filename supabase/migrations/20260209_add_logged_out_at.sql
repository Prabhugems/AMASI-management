-- Add logged_out_at column to users table for tracking explicit logout
ALTER TABLE users ADD COLUMN IF NOT EXISTS logged_out_at TIMESTAMPTZ DEFAULT NULL;
