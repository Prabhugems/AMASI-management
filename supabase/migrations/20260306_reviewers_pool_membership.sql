-- Add AMASI membership fields to reviewers_pool
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS amasi_membership_number TEXT;
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS is_amasi_member BOOLEAN DEFAULT false;
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS is_amasi_faculty BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_reviewers_pool_membership ON reviewers_pool(amasi_membership_number);
