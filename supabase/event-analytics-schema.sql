-- Event Analytics Schema
-- Tracks page views, unique visitors, and leads for event pages

-- 1. Page Views Table - tracks every page view
CREATE TABLE IF NOT EXISTS event_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL, -- Anonymous visitor ID (from cookie/fingerprint)
  page_type TEXT NOT NULL DEFAULT 'event', -- 'event', 'register', 'checkout'
  referrer TEXT, -- Where they came from
  utm_source TEXT, -- UTM tracking
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  browser TEXT,
  country TEXT,
  city TEXT,
  ip_hash TEXT, -- Hashed IP for privacy
  session_id TEXT, -- Group views by session
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Daily Analytics Summary - aggregated stats per day
CREATE TABLE IF NOT EXISTS event_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  page_views INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  registration_page_views INT DEFAULT 0,
  checkout_page_views INT DEFAULT 0,
  registrations INT DEFAULT 0, -- Successful registrations that day
  conversion_rate DECIMAL(5,2) DEFAULT 0, -- registrations / unique_visitors * 100
  top_referrer TEXT,
  top_utm_source TEXT,
  desktop_views INT DEFAULT 0,
  mobile_views INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, date)
);

-- 3. Event Leads Table - people interested but not registered
CREATE TABLE IF NOT EXISTS event_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  source TEXT DEFAULT 'notify_me', -- 'notify_me', 'abandoned_checkout', 'waitlist'
  visitor_id TEXT, -- Link to their page views
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  status TEXT DEFAULT 'new', -- 'new', 'contacted', 'converted', 'unsubscribed'
  converted_at TIMESTAMPTZ, -- When they registered
  registration_id UUID REFERENCES registrations(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, email)
);

-- 4. Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_page_views_event_id ON event_page_views(event_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON event_page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_id ON event_page_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON event_page_views(session_id);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_event_date ON event_analytics_daily(event_id, date);
CREATE INDEX IF NOT EXISTS idx_leads_event_id ON event_leads(event_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON event_leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON event_leads(status);

-- 5. Function to aggregate daily analytics
CREATE OR REPLACE FUNCTION aggregate_event_analytics(p_event_id UUID, p_date DATE)
RETURNS void AS $$
DECLARE
  v_page_views INT;
  v_unique_visitors INT;
  v_reg_views INT;
  v_checkout_views INT;
  v_registrations INT;
  v_desktop INT;
  v_mobile INT;
  v_top_referrer TEXT;
  v_top_utm TEXT;
BEGIN
  -- Count page views
  SELECT COUNT(*) INTO v_page_views
  FROM event_page_views
  WHERE event_id = p_event_id AND DATE(created_at) = p_date;

  -- Count unique visitors
  SELECT COUNT(DISTINCT visitor_id) INTO v_unique_visitors
  FROM event_page_views
  WHERE event_id = p_event_id AND DATE(created_at) = p_date;

  -- Count registration page views
  SELECT COUNT(*) INTO v_reg_views
  FROM event_page_views
  WHERE event_id = p_event_id AND DATE(created_at) = p_date AND page_type = 'register';

  -- Count checkout page views
  SELECT COUNT(*) INTO v_checkout_views
  FROM event_page_views
  WHERE event_id = p_event_id AND DATE(created_at) = p_date AND page_type = 'checkout';

  -- Count registrations
  SELECT COUNT(*) INTO v_registrations
  FROM registrations
  WHERE event_id = p_event_id AND DATE(created_at) = p_date AND status != 'cancelled';

  -- Count device types
  SELECT COUNT(*) INTO v_desktop
  FROM event_page_views
  WHERE event_id = p_event_id AND DATE(created_at) = p_date AND device_type = 'desktop';

  SELECT COUNT(*) INTO v_mobile
  FROM event_page_views
  WHERE event_id = p_event_id AND DATE(created_at) = p_date AND device_type IN ('mobile', 'tablet');

  -- Get top referrer
  SELECT referrer INTO v_top_referrer
  FROM event_page_views
  WHERE event_id = p_event_id AND DATE(created_at) = p_date AND referrer IS NOT NULL AND referrer != ''
  GROUP BY referrer
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Get top UTM source
  SELECT utm_source INTO v_top_utm
  FROM event_page_views
  WHERE event_id = p_event_id AND DATE(created_at) = p_date AND utm_source IS NOT NULL
  GROUP BY utm_source
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Upsert daily analytics
  INSERT INTO event_analytics_daily (
    event_id, date, page_views, unique_visitors, registration_page_views,
    checkout_page_views, registrations, conversion_rate, top_referrer,
    top_utm_source, desktop_views, mobile_views, updated_at
  ) VALUES (
    p_event_id, p_date, v_page_views, v_unique_visitors, v_reg_views,
    v_checkout_views, v_registrations,
    CASE WHEN v_unique_visitors > 0 THEN ROUND((v_registrations::DECIMAL / v_unique_visitors) * 100, 2) ELSE 0 END,
    v_top_referrer, v_top_utm, v_desktop, v_mobile, NOW()
  )
  ON CONFLICT (event_id, date) DO UPDATE SET
    page_views = EXCLUDED.page_views,
    unique_visitors = EXCLUDED.unique_visitors,
    registration_page_views = EXCLUDED.registration_page_views,
    checkout_page_views = EXCLUDED.checkout_page_views,
    registrations = EXCLUDED.registrations,
    conversion_rate = EXCLUDED.conversion_rate,
    top_referrer = EXCLUDED.top_referrer,
    top_utm_source = EXCLUDED.top_utm_source,
    desktop_views = EXCLUDED.desktop_views,
    mobile_views = EXCLUDED.mobile_views,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 6. RLS Policies
ALTER TABLE event_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_leads ENABLE ROW LEVEL SECURITY;

-- Allow public inserts for tracking (anonymous visitors)
CREATE POLICY "Allow public insert on page_views"
  ON event_page_views FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow authenticated users to read their event analytics
CREATE POLICY "Allow read for event owners"
  ON event_page_views FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT id FROM events WHERE created_by = auth.uid())
  );

CREATE POLICY "Allow read analytics for event owners"
  ON event_analytics_daily FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT id FROM events WHERE created_by = auth.uid())
  );

-- Leads policies
CREATE POLICY "Allow public insert on leads"
  ON event_leads FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow read leads for event owners"
  ON event_leads FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT id FROM events WHERE created_by = auth.uid())
  );

CREATE POLICY "Allow update leads for event owners"
  ON event_leads FOR UPDATE
  TO authenticated
  USING (
    event_id IN (SELECT id FROM events WHERE created_by = auth.uid())
  );

-- Service role bypass
CREATE POLICY "Service role full access page_views"
  ON event_page_views FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access analytics"
  ON event_analytics_daily FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access leads"
  ON event_leads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
