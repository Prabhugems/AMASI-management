-- Add subject field to abstracts table
ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add comment
COMMENT ON COLUMN abstracts.subject IS 'Subject/Topic of the abstract (e.g., Laparoscopic Surgery, Bariatric Surgery)';
