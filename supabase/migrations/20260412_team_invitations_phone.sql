-- Add phone column to team_invitations for WhatsApp resend
ALTER TABLE team_invitations ADD COLUMN IF NOT EXISTS phone TEXT;
