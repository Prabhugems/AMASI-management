-- Add membership settings columns to forms table
-- is_member_form: Enable AMASI membership verification for this form
-- membership_required_strict: If true, block non-members (for exams). If false, allow non-members but show membership benefits (for events with member discounts)

ALTER TABLE forms
ADD COLUMN IF NOT EXISTS is_member_form BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS membership_required_strict BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN forms.is_member_form IS 'Enable AMASI membership verification for this form';
COMMENT ON COLUMN forms.membership_required_strict IS 'If true, block non-members from submitting. If false, allow non-members but verify membership for discounts';
