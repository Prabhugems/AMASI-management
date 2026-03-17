-- Add enable_examination column to event_settings
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS enable_examination boolean DEFAULT false;

-- Add examination-related columns to registrations for storing exam results
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS exam_marks jsonb DEFAULT NULL;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS exam_result text DEFAULT NULL; -- 'pass', 'fail', 'absent'
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS exam_total_marks numeric DEFAULT NULL;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS convocation_number text DEFAULT NULL;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS convocation_address jsonb DEFAULT NULL;
-- convocation_address: { address_line1, address_line2, city, state, pincode, country }

COMMENT ON COLUMN registrations.exam_marks IS 'JSON object storing marks breakdown: { theory: number, quiz: number, publication: number, viva: number, skills: number }';
COMMENT ON COLUMN registrations.exam_result IS 'Exam result: pass, fail, or absent';
COMMENT ON COLUMN registrations.exam_total_marks IS 'Total marks obtained out of 100';
COMMENT ON COLUMN registrations.convocation_number IS 'Unique convocation/certificate number assigned after passing';
COMMENT ON COLUMN registrations.convocation_address IS 'Address for sending convocation certificate';
