-- ============================================================
-- MMAS Hernia Exam Form + Template + Ticket Link
-- Event: MMAS-B (8db2c778-c96d-46da-ac20-00604e764853)
-- ============================================================

-- Step 1: Create the form
INSERT INTO forms (
  id, name, description, form_type, event_id, status,
  is_public, is_member_form, membership_required_strict,
  submit_button_text, success_message, primary_color
) VALUES (
  gen_random_uuid(),
  'MMAS Hernia Exam Form',
  'Registration form for MMAS Hernia Exam - requires AMASI membership verification',
  'event_registration',
  '8db2c778-c96d-46da-ac20-00604e764853',
  'published',
  true,
  true,
  true,
  'Submit Registration',
  'Thank you for registering for the MMAS Hernia Exam! You will receive a confirmation email shortly.',
  '#059669'
);

-- Get the form ID we just created
-- (using a CTE-style approach for the field inserts)

-- Step 2: Create form fields
-- We need the form_id, so we'll use a DO block
DO $$
DECLARE
  v_form_id uuid;
  v_ticket_type_id uuid;
BEGIN
  -- Get the form we just created
  SELECT id INTO v_form_id
  FROM forms
  WHERE name = 'MMAS Hernia Exam Form'
    AND event_id = '8db2c778-c96d-46da-ac20-00604e764853'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_form_id IS NULL THEN
    RAISE EXCEPTION 'Form not found - insert may have failed';
  END IF;

  RAISE NOTICE 'Form ID: %', v_form_id;

  -- Field 0: Email Address
  INSERT INTO form_fields (form_id, field_type, label, placeholder, is_required, sort_order, settings)
  VALUES (v_form_id, 'email', 'Email Address', 'Enter your email address', true, 0,
    '{"member_lookup": true}'::jsonb);

  -- Field 1: AMASI Membership Number
  INSERT INTO form_fields (form_id, field_type, label, placeholder, is_required, sort_order)
  VALUES (v_form_id, 'text', 'AMASI Membership Number', 'Your AMASI membership number', true, 1);

  -- Field 2: First Name
  INSERT INTO form_fields (form_id, field_type, label, placeholder, is_required, sort_order)
  VALUES (v_form_id, 'text', 'First Name', 'Enter your first name', true, 2);

  -- Field 3: Last Name
  INSERT INTO form_fields (form_id, field_type, label, placeholder, is_required, sort_order)
  VALUES (v_form_id, 'text', 'Last Name', 'Enter your last name', true, 3);

  -- Field 4: Mobile Number
  INSERT INTO form_fields (form_id, field_type, label, placeholder, is_required, sort_order, settings)
  VALUES (v_form_id, 'phone', 'Mobile Number', 'Enter your mobile number', true, 4,
    '{"show_country": true, "default_country": "IN"}'::jsonb);

  -- Field 5: Choose Your Degree Details
  INSERT INTO form_fields (form_id, field_type, label, placeholder, is_required, sort_order, options)
  VALUES (v_form_id, 'select', 'Choose Your Degree Details', 'Select your degree', true, 5,
    '[
      {"value": "MS", "label": "MS"},
      {"value": "MD", "label": "MD"},
      {"value": "MCh", "label": "MCh"},
      {"value": "DNB", "label": "DNB"},
      {"value": "FNB", "label": "FNB"},
      {"value": "MBBS", "label": "MBBS"},
      {"value": "Other", "label": "Other"}
    ]'::jsonb);

  -- Field 6: When Did You Complete Your MS Degree
  INSERT INTO form_fields (form_id, field_type, label, help_text, is_required, sort_order)
  VALUES (v_form_id, 'date', 'When Did You Complete Your MS Degree', 'Select the date of your MS degree completion', true, 6);

  -- Field 7: Present Place Of Work
  INSERT INTO form_fields (form_id, field_type, label, placeholder, is_required, sort_order)
  VALUES (v_form_id, 'text', 'Present Place Of Work', 'Enter your current workplace', false, 7);

  -- Field 8: Research Articles On Hernia Diseases
  INSERT INTO form_fields (form_id, field_type, label, help_text, is_required, sort_order, settings)
  VALUES (v_form_id, 'file', 'Research Articles On Hernia Diseases',
    'Upload your research articles (PDF or DOC format, max 10MB each)', false, 8,
    '{"allow_multiple": true, "max_files": 5, "allowed_file_types": ["pdf", "doc", "docx"], "max_file_size": 10}'::jsonb);

  -- Field 9: Any Hernia Surgery Video Personal Work
  INSERT INTO form_fields (form_id, field_type, label, help_text, is_required, sort_order, settings)
  VALUES (v_form_id, 'file', 'Any Hernia Surgery Video Personal Work',
    'Upload your hernia surgery video (MP4 or MOV format, max 100MB)', false, 9,
    '{"allow_multiple": false, "max_files": 1, "allowed_file_types": ["mp4", "mov"], "max_file_size": 100}'::jsonb);

  -- Field 10: MCh MAS/FNB/MS/DNB Pass Certificate
  INSERT INTO form_fields (form_id, field_type, label, help_text, is_required, sort_order, settings)
  VALUES (v_form_id, 'file', 'MCh MAS/FNB/MS/DNB Pass Certificate',
    'Upload your pass certificate(s) (PDF, JPG, or PNG format, max 10MB each)', true, 10,
    '{"allow_multiple": true, "max_files": 5, "allowed_file_types": ["pdf", "jpg", "jpeg", "png"], "max_file_size": 10}'::jsonb);

  -- Step 3: Link form to MMAS Exam ticket type
  SELECT id INTO v_ticket_type_id
  FROM ticket_types
  WHERE event_id = '8db2c778-c96d-46da-ac20-00604e764853'
    AND name ILIKE '%MMAS Exam%'
  LIMIT 1;

  IF v_ticket_type_id IS NOT NULL THEN
    UPDATE ticket_types
    SET form_id = v_form_id
    WHERE id = v_ticket_type_id;

    RAISE NOTICE 'Linked form to ticket type: %', v_ticket_type_id;
  ELSE
    RAISE WARNING 'MMAS Exam ticket type not found - please link manually';
  END IF;

  -- Step 4: Create form template for reuse
  INSERT INTO form_templates (name, description, category, form_config, is_system)
  VALUES (
    'MMAS Hernia Exam Form',
    'Exam registration form for MMAS Hernia course - includes AMASI membership verification, degree details, research articles, surgery videos, and pass certificates',
    'exam',
    jsonb_build_object(
      'name', 'MMAS Hernia Exam Form',
      'description', 'Registration form for MMAS Hernia Exam',
      'form_type', 'event_registration',
      'is_member_form', true,
      'membership_required_strict', true,
      'settings', jsonb_build_object(
        'submit_button_text', 'Submit Registration',
        'success_message', 'Thank you for registering for the MMAS Hernia Exam!'
      ),
      'fields', jsonb_build_array(
        jsonb_build_object('field_type', 'email', 'label', 'Email Address', 'is_required', true, 'sort_order', 0, 'settings', '{"member_lookup": true}'::jsonb),
        jsonb_build_object('field_type', 'text', 'label', 'AMASI Membership Number', 'is_required', true, 'sort_order', 1),
        jsonb_build_object('field_type', 'text', 'label', 'First Name', 'is_required', true, 'sort_order', 2),
        jsonb_build_object('field_type', 'text', 'label', 'Last Name', 'is_required', true, 'sort_order', 3),
        jsonb_build_object('field_type', 'phone', 'label', 'Mobile Number', 'is_required', true, 'sort_order', 4, 'settings', '{"show_country": true, "default_country": "IN"}'::jsonb),
        jsonb_build_object('field_type', 'select', 'label', 'Choose Your Degree Details', 'is_required', true, 'sort_order', 5, 'options', '[{"value":"MS","label":"MS"},{"value":"MD","label":"MD"},{"value":"MCh","label":"MCh"},{"value":"DNB","label":"DNB"},{"value":"FNB","label":"FNB"},{"value":"MBBS","label":"MBBS"},{"value":"Other","label":"Other"}]'::jsonb),
        jsonb_build_object('field_type', 'date', 'label', 'When Did You Complete Your MS Degree', 'is_required', true, 'sort_order', 6),
        jsonb_build_object('field_type', 'text', 'label', 'Present Place Of Work', 'is_required', false, 'sort_order', 7),
        jsonb_build_object('field_type', 'file', 'label', 'Research Articles On Hernia Diseases', 'is_required', false, 'sort_order', 8, 'settings', '{"allow_multiple": true, "max_files": 5, "allowed_file_types": ["pdf", "doc", "docx"], "max_file_size": 10}'::jsonb),
        jsonb_build_object('field_type', 'file', 'label', 'Any Hernia Surgery Video Personal Work', 'is_required', false, 'sort_order', 9, 'settings', '{"allow_multiple": false, "max_files": 1, "allowed_file_types": ["mp4", "mov"], "max_file_size": 100}'::jsonb),
        jsonb_build_object('field_type', 'file', 'label', 'MCh MAS/FNB/MS/DNB Pass Certificate', 'is_required', true, 'sort_order', 10, 'settings', '{"allow_multiple": true, "max_files": 5, "allowed_file_types": ["pdf", "jpg", "jpeg", "png"], "max_file_size": 10}'::jsonb)
      )
    ),
    true
  );

  RAISE NOTICE 'Form template created successfully';

  -- Step 5: Fix quantity_sold for MMAS Exam ticket
  -- Sync quantity_sold from actual registration count
  UPDATE ticket_types tt
  SET quantity_sold = (
    SELECT COALESCE(SUM(COALESCE(r.quantity, 1)), 0)
    FROM registrations r
    WHERE r.ticket_type_id = tt.id
      AND r.status IN ('confirmed', 'completed')
  )
  WHERE tt.event_id = '8db2c778-c96d-46da-ac20-00604e764853';

  RAISE NOTICE 'Synced quantity_sold for all MMAS-B ticket types';

END $$;
