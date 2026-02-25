ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS auto_send_survey BOOLEAN DEFAULT false;
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS survey_form_id UUID REFERENCES forms(id);
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS survey_send_delay_hours INTEGER DEFAULT 24;
