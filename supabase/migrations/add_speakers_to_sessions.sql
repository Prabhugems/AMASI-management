-- Add speaker/chairperson/moderator columns to sessions table
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS speakers text,
ADD COLUMN IF NOT EXISTS chairpersons text,
ADD COLUMN IF NOT EXISTS moderators text;

-- Add comment for documentation
COMMENT ON COLUMN sessions.speakers IS 'Comma-separated list of speaker names';
COMMENT ON COLUMN sessions.chairpersons IS 'Comma-separated list of chairperson names';
COMMENT ON COLUMN sessions.moderators IS 'Comma-separated list of moderator names';
