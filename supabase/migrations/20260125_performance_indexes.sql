-- Performance Indexes for Common Queries
-- These indexes optimize frequently used query patterns

-- Registrations: Common lookups by email and event
CREATE INDEX IF NOT EXISTS idx_registrations_event_email
ON registrations(event_id, lower(attendee_email));

CREATE INDEX IF NOT EXISTS idx_registrations_event_status
ON registrations(event_id, status);

CREATE INDEX IF NOT EXISTS idx_registrations_event_ticket
ON registrations(event_id, ticket_type_id);

CREATE INDEX IF NOT EXISTS idx_registrations_created_at
ON registrations(created_at DESC);

-- Check-in records: Optimize check-in lookups
CREATE INDEX IF NOT EXISTS idx_checkin_records_list_registration
ON checkin_records(checkin_list_id, registration_id)
WHERE checked_out_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_checkin_records_checked_in_at
ON checkin_records(checked_in_at DESC);

-- Sessions: Common lookups for schedule
CREATE INDEX IF NOT EXISTS idx_sessions_event_date
ON sessions(event_id, session_date, start_time);

CREATE INDEX IF NOT EXISTS idx_sessions_hall
ON sessions(event_id, hall_id);

-- Speakers: Common lookups
CREATE INDEX IF NOT EXISTS idx_speakers_event_status
ON speakers(event_id, status);

CREATE INDEX IF NOT EXISTS idx_speakers_email
ON speakers(lower(email));

-- Faculty: Common lookups
CREATE INDEX IF NOT EXISTS idx_faculty_email
ON faculty(lower(email));

CREATE INDEX IF NOT EXISTS idx_faculty_status
ON faculty(status);

-- Orders/Payments: Common lookups
CREATE INDEX IF NOT EXISTS idx_orders_event_status
ON orders(event_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_order_status
ON payments(order_id, status);

-- Form submissions: Common lookups
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_status
ON form_submissions(form_id, status);

CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at
ON form_submissions(submitted_at DESC);

-- Members: Lookup optimization
CREATE INDEX IF NOT EXISTS idx_members_email_lower
ON members(lower(email));

CREATE INDEX IF NOT EXISTS idx_members_status
ON members(status);

-- Sponsors: Common lookups
CREATE INDEX IF NOT EXISTS idx_sponsors_event_status
ON sponsors(event_id, status);

-- Travel bookings: Common lookups
CREATE INDEX IF NOT EXISTS idx_flight_bookings_event_status
ON flight_bookings(event_id, status);

CREATE INDEX IF NOT EXISTS idx_train_bookings_event_status
ON train_bookings(event_id, status);

CREATE INDEX IF NOT EXISTS idx_cab_bookings_event_status
ON cab_bookings(event_id, status);

-- Hotel bookings: Common lookups
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_event_status
ON hotel_bookings(event_id, status);

-- Activity logs: Optimize recent activity queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_created
ON activity_logs(event_id, created_at DESC);

-- Communication logs: Optimize lookups
CREATE INDEX IF NOT EXISTS idx_communication_logs_event_created
ON communication_logs(event_id, created_at DESC);

-- Addons: Sales lookups
CREATE INDEX IF NOT EXISTS idx_registration_addons_addon
ON registration_addons(addon_id);

CREATE INDEX IF NOT EXISTS idx_addons_event_active
ON addons(event_id, is_active);

COMMENT ON INDEX idx_registrations_event_email IS 'Optimize email lookups for duplicate detection';
COMMENT ON INDEX idx_checkin_records_list_registration IS 'Optimize active check-in lookups';
COMMENT ON INDEX idx_sessions_event_date IS 'Optimize schedule queries by date';
