-- Enhanced reviewer profile fields
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS orcid_id TEXT;
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS publications_count INTEGER DEFAULT 0;
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS research_interests TEXT;
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS languages TEXT[];
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS available_for_review BOOLEAN DEFAULT true;
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS max_reviews_per_month INTEGER DEFAULT 5;
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS total_reviews_completed INTEGER DEFAULT 0;
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS avg_review_time_days NUMERIC(4,1);
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS last_review_at TIMESTAMPTZ;
ALTER TABLE reviewers_pool ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1);
