-- 1. Create departments table
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    officer TEXT NOT NULL,
    contact TEXT NOT NULL,
    active_cases INTEGER DEFAULT 0 NOT NULL,
    total_cases INTEGER DEFAULT 0 NOT NULL,
    sla_hours INTEGER NOT NULL,
    sla_breaches INTEGER DEFAULT 0 NOT NULL,
    sla_compliance INTEGER DEFAULT 95 NOT NULL,
    workload_score INTEGER DEFAULT 0 NOT NULL,
    recommended_action TEXT
);

COMMENT ON TABLE departments IS 'Stores department details, contact info, and real-time active workload statistics.';

-- 2. Seed departments table
INSERT INTO departments (id, name, short_name, officer, contact, active_cases, total_cases, sla_hours, sla_breaches, sla_compliance, workload_score, recommended_action) VALUES
('dept-safety', 'Public Safety and Police Liaison', 'Safety', 'Nodal Safety Officer', 'safety-cell@example.gov.in', 0, 0, 24, 0, 95, 0, 'Maintain current response cadence.'),
('dept-pwd', 'Public Works Department', 'PWD', 'Executive Engineer', 'pwd-control@example.gov.in', 0, 0, 72, 0, 95, 0, 'Maintain current response cadence.'),
('dept-water', 'Water Supply and Sewerage Board', 'Water Board', 'Assistant Engineer, Water Services', 'water-desk@example.gov.in', 0, 0, 48, 0, 95, 0, 'Maintain current response cadence.'),
('dept-electricity', 'Electricity and Streetlight Maintenance', 'Power', 'Junior Engineer, Electrical', 'power-desk@example.gov.in', 0, 0, 36, 0, 95, 0, 'Maintain current response cadence.'),
('dept-solid-waste', 'Solid Waste Management Cell', 'SWM', 'Health Inspector', 'swm-cell@example.gov.in', 0, 0, 24, 0, 95, 0, 'Maintain current response cadence.')
ON CONFLICT (id) DO NOTHING;

-- 3. Create cases table
CREATE TABLE IF NOT EXISTS cases (
    case_id TEXT PRIMARY KEY,
    work_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    department_id TEXT REFERENCES departments(id),
    status TEXT NOT NULL DEFAULT 'New',
    priority_score NUMERIC DEFAULT 0.0 NOT NULL,
    priority_band TEXT NOT NULL,
    sla_deadline TIMESTAMPTZ NOT NULL,
    sla_status TEXT NOT NULL DEFAULT 'On Track',
    citizen_count INTEGER DEFAULT 1 NOT NULL,
    ward TEXT NOT NULL,
    geo JSONB DEFAULT '{}'::jsonb NOT NULL,
    resolution_brief JSONB DEFAULT '{}'::jsonb NOT NULL,
    scheme_matches JSONB DEFAULT '[]'::jsonb NOT NULL,
    evidence JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    latest_update TEXT
);

COMMENT ON TABLE cases IS 'Stores actionable municipal cases (tickets) generated from priorities or direct submissions.';

-- 4. Seed cases from existing priorities table
INSERT INTO cases (case_id, work_id, title, category, department_id, status, priority_score, priority_band, sla_deadline, sla_status, citizen_count, ward, geo, resolution_brief, scheme_matches, evidence, latest_update, created_at, updated_at)
SELECT
  'CASE-' || substring(work_id::text from 13 for 8) as case_id,
  work_id,
  title,
  category,
  CASE 
    WHEN category IN ('Mobility - Roads, Footpaths and Infrastructure', 'PWD', 'Traffic and Road Safety') THEN 'dept-pwd'
    WHEN category IN ('Water Supply and Services', 'Sanitation') THEN 'dept-water'
    WHEN category IN ('Garbage and Unsanitary Practices', 'Pollution', 'Yellow Spot') THEN 'dept-solid-waste'
    WHEN category IN ('Streetlights', 'Electricity and Power Supply') THEN 'dept-electricity'
    ELSE 'dept-safety'
  END as department_id,
  'New' as status,
  demand_score as priority_score,
  CASE WHEN demand_score >= 75 THEN 'Critical' WHEN demand_score >= 55 THEN 'High' ELSE 'Medium' END as priority_band,
  now() + interval '48 hours' as sla_deadline,
  'On Track' as sla_status,
  demand_count as citizen_count,
  COALESCE(hotspot_geo->>'ward', 'Bengaluru South') as ward,
  hotspot_geo as geo,
  jsonb_build_object(
    'summary', title,
    'primary_department', category,
    'why_now', explanation,
    'first_action', 'Assign field verification team.',
    'recommended_steps', jsonb_build_array('Verify site location', 'Perform scoping study')
  ) as resolution_brief,
  '[]'::jsonb as scheme_matches,
  supporting_evidence as evidence,
  'Awaiting department assignment.' as latest_update,
  created_at,
  updated_at
FROM priorities
ON CONFLICT (case_id) DO NOTHING;

-- 5. Update initial department case counts based on seeded cases
UPDATE departments d
SET active_cases = (SELECT COUNT(*) FROM cases c WHERE c.department_id = d.id AND c.status != 'Resolved'),
    total_cases = (SELECT COUNT(*) FROM cases c WHERE c.department_id = d.id);

-- 6. Create proactive_alerts table
CREATE TABLE IF NOT EXISTS proactive_alerts (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_tooltip TEXT NOT NULL,
    ingestion_type TEXT NOT NULL,
    predictive_status TEXT NOT NULL DEFAULT 'System-Detected',
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    geo JSONB DEFAULT '{}'::jsonb NOT NULL,
    location_label TEXT NOT NULL,
    details TEXT NOT NULL,
    suggested_action TEXT NOT NULL,
    department TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE proactive_alerts IS 'Stores system-detected alerts from telemetry feeds before they are converted to actionable orders.';

-- 7. Seed proactive_alerts table with 6 default entries
INSERT INTO proactive_alerts (id, source, source_tooltip, ingestion_type, predictive_status, title, category, priority, timestamp, geo, location_label, details, suggested_action, department) VALUES
('PRO_001', 'BWSSB Water Pressure Telemetry Network', 'Source: BWSSB SCADA', 'SCADA Telemetry', 'System-Detected', 'Severe pressure drop detected across 4 distribution nodes', 'Water Supply and Services', 'Critical', '12 mins ago', '{"lat": 12.9165, "lng": 77.6101}'::jsonb, 'BTM Layout 2nd Stage (Node W-402)', 'Automated crawl of municipal SCADA telemetry indicates a 42% pressure drop in morning supply lines. Possible subsurface pipe rupture or illegal diversion.', 'Dispatch BWSSB acoustic leak detection team immediately before citizen complaints spike.', 'Bangalore Water Supply and Sewerage Board (BWSSB)'),
('PRO_002', 'BBMP Monsoon Drain Monitoring Cameras', 'Source: BBMP CV Feed #19', 'Computer Vision (CV)', 'System-Detected', 'Silt & solid waste blockage at major stormwater conduit', 'Sanitation', 'Critical', '28 mins ago', '{"lat": 12.9352, "lng": 77.6245}'::jsonb, 'Koramangala 4th Block (Drain C-19)', 'Automated computer vision crawl of BBMP drain monitoring cameras identified 75% flow obstruction caused by dumped construction debris and plastics.', 'Deploy mechanical excavator and solid waste clearance crew prior to evening monsoon showers.', 'Bruhat Bengaluru Mahanagara Palike (BBMP) Solid Waste / Drainage'),
('PRO_003', 'Local Civic News Scraper (Deccan Herald / Public Eye)', 'Source: Civic News NLP Crawl', 'News Feeds (NLP)', 'System-Detected', 'High-voltage transformer oil leakage reported by neighborhood watch', 'Electricity and Power Supply', 'Warning', '1 hour ago', '{"lat": 12.9229, "lng": 77.5852}'::jsonb, 'Jayanagar 4th Block Shopping Complex', 'NLP news crawler aggregated 4 independent social civic posts and local news tickers warning of overheating and oil dripping from 250kVA transformer feeder.', 'Schedule emergency BESCOM thermal inspection and bushing replacement during off-peak window.', 'BESCOM (Bangalore Electricity Supply Company)'),
('PRO_004', 'Municipal Traffic Camera Pavement Analysis Scraper', 'Source: BTP Traffic Cam CV', 'Computer Vision (CV)', 'System-Detected', 'Rapid asphalt degradation & pothole cluster developing', 'Mobility - Roads, Footpaths and Infrastructure', 'Warning', '2 hours ago', '{"lat": 12.9081, "lng": 77.5753}'::jsonb, 'Banashankari 2nd Stage Outer Ring Road Junction', 'Traffic camera computer vision surface crawl flagged a 6-meter stretch of crumbling bitumen with standing water, slowing traffic flow by 35% during rush hour.', 'Assign PWD rapid road patching unit for cold-mix asphalt repair.', 'Public Works Department (PWD) / BBMP Roads'),
('PRO_005', 'Public Health Open Data Portal Scraper', 'Source: Public Health NLP', 'News Feeds (NLP)', 'System-Detected', 'Localized spike in mosquito vector density index', 'Sanitation', 'Monitor', '3 hours ago', '{"lat": 12.8997, "lng": 77.5963}'::jsonb, 'JP Nagar 6th Phase Lake Periphery', 'Scraping of weekly health inspector sample logs shows a 3x increase in dengue vector larvae near stagnant marshland pockets.', 'Deploy municipal fogging and larvicide spraying unit across a 500m radius.', 'BBMP Health & Sanitation Department'),
('PRO_006', 'Smart City Streetlight IoT Gateway Crawl', 'Source: Streetlight SCADA', 'SCADA Telemetry', 'System-Detected', 'Feeder circuit trip affecting 18 street lamps', 'Electricity and Power Supply', 'Monitor', '5 hours ago', '{"lat": 12.9121, "lng": 77.6351}'::jsonb, 'HSR Layout Sector 2 (27th Main)', 'Automated query of smart IoT streetlight SCADA controllers revealed an automated breaker trip, leaving 400m of residential sidewalk unlit.', 'Dispatch electrical maintenance contractor to reset feeder and inspect circuit insulation.', 'BBMP Electrical Engineering Wing / BESCOM')
ON CONFLICT (id) DO NOTHING;

-- 8. Create atomic transaction for case assignment
CREATE OR REPLACE FUNCTION assign_case_transaction(p_case_id TEXT, p_department_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_dept_id TEXT;
    v_old_status TEXT;
BEGIN
    -- Get current state
    SELECT department_id, status INTO v_old_dept_id, v_old_status FROM cases WHERE case_id = p_case_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Case % not found', p_case_id;
    END IF;

    -- 1. Update the case record status and department
    UPDATE cases 
    SET status = 'Assigned',
        department_id = p_department_id,
        latest_update = 'Assigned to department for remediation.',
        updated_at = now()
    WHERE case_id = p_case_id;

    -- 2. Decrement from the old department active cases count (if previously assigned and not resolved)
    IF v_old_dept_id IS NOT NULL AND v_old_status = 'Assigned' AND v_old_dept_id != p_department_id THEN
        UPDATE departments 
        SET active_cases = GREATEST(0, active_cases - 1)
        WHERE id = v_old_dept_id;
    END IF;

    -- 3. Increment the new department active_cases and total_cases counts
    UPDATE departments 
    SET active_cases = active_cases + 1,
        total_cases = total_cases + 1
    WHERE id = p_department_id;

    -- 4. Sync status into the priorities overrides table if corresponding work_id exists
    UPDATE priorities
    SET updated_at = now()
    WHERE work_id = (SELECT work_id FROM cases WHERE case_id = p_case_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 9. Create atomic transaction for converting proactive alert to actionable priority
CREATE OR REPLACE FUNCTION convert_proactive_alert(p_alert_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_alert RECORD;
    v_work_id TEXT;
    v_case_id TEXT;
    v_score NUMERIC;
    v_priority_band TEXT;
    v_dept_id TEXT;
    v_sla_hours INTEGER;
    v_dept_name TEXT;
    v_officer TEXT;
BEGIN
    -- Retrieve alert details
    SELECT * INTO v_alert FROM proactive_alerts WHERE id = p_alert_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Proactive alert % not found', p_alert_id;
    END IF;

    v_work_id := v_alert.id;
    v_case_id := 'CASE-' || substring(v_alert.id from 5); -- PRO_001 -> CASE-001
    
    -- Scoring logic
    v_score := CASE 
        WHEN v_alert.priority = 'Critical' THEN 94.5 
        WHEN v_alert.priority = 'Warning' THEN 82.0 
        ELSE 71.0 
    END;
    v_priority_band := CASE 
        WHEN v_alert.priority = 'Critical' THEN 'Critical'
        WHEN v_alert.priority = 'Warning' THEN 'High'
        ELSE 'Medium'
    END;

    -- Department mapping
    IF v_alert.department LIKE '%BBMP%' OR v_alert.department LIKE '%SWM%' THEN
        v_dept_id := 'dept-solid-waste';
        v_dept_name := 'Solid Waste Management Cell';
        v_officer := 'Health Inspector';
        v_sla_hours := 24;
    ELSIF v_alert.department LIKE '%BWSSB%' OR v_alert.department LIKE '%Water%' THEN
        v_dept_id := 'dept-water';
        v_dept_name := 'Water Supply and Sewerage Board';
        v_officer := 'Assistant Engineer, Water Services';
        v_sla_hours := 48;
    ELSIF v_alert.department LIKE '%BESCOM%' OR v_alert.department LIKE '%Electrical%' OR v_alert.department LIKE '%Power%' THEN
        v_dept_id := 'dept-electricity';
        v_dept_name := 'Electricity and Streetlight Maintenance';
        v_officer := 'Junior Engineer, Electrical';
        v_sla_hours := 36;
    ELSIF v_alert.department LIKE '%PWD%' OR v_alert.department LIKE '%Road%' THEN
        v_dept_id := 'dept-pwd';
        v_dept_name := 'Public Works Department';
        v_officer := 'Executive Engineer';
        v_sla_hours := 72;
    ELSE
        v_dept_id := 'dept-safety';
        v_dept_name := 'Public Safety and Police Liaison';
        v_officer := 'Nodal Safety Officer';
        v_sla_hours := 24;
    END IF;

    -- 1. Insert into priorities (Confirmed)
    INSERT INTO priorities (
        work_id,
        title,
        category,
        demand_score,
        demand_count,
        hotspot_geo,
        supporting_evidence,
        rank,
        explanation
    ) VALUES (
        v_work_id,
        '[PROACTIVE CRAWL] ' || v_alert.title,
        v_alert.category,
        v_score,
        1,
        v_alert.geo,
        jsonb_build_array(
            jsonb_build_object(
                'submission_id', 'SUB_' || v_alert.id,
                'raw_text', v_alert.details,
                'normalized_text_en', v_alert.details,
                'language', 'English',
                'geo', v_alert.geo,
                'canonical_location', v_alert.location_label
            )
        ),
        1,
        'Identified proactively via ' || v_alert.ingestion_type || ': ' || v_alert.details
    )
    ON CONFLICT (work_id) DO UPDATE SET
        demand_score = EXCLUDED.demand_score,
        demand_count = priorities.demand_count + 1;

    -- 2. Insert into cases (Ticket)
    INSERT INTO cases (
        case_id,
        work_id,
        title,
        category,
        department_id,
        status,
        priority_score,
        priority_band,
        sla_deadline,
        sla_status,
        citizen_count,
        ward,
        geo,
        resolution_brief,
        scheme_matches,
        evidence,
        latest_update
    ) VALUES (
        v_case_id,
        v_work_id,
        '[PROACTIVE CRAWL] ' || v_alert.title,
        v_alert.category,
        v_dept_id,
        'Open',
        v_score,
        v_priority_band,
        now() + (v_sla_hours || ' hours')::interval,
        'On Track',
        1,
        split_part(v_alert.location_label, ' ', 1),
        v_alert.geo,
        jsonb_build_object(
            'summary', '[PROACTIVE CRAWL] ' || v_alert.title,
            'primary_department', v_dept_name,
            'officer', v_officer,
            'why_now', 'Identified proactively via ' || v_alert.ingestion_type || ': ' || v_alert.details,
            'first_action', 'Verify telemetry baseline after intervention.',
            'recommended_steps', jsonb_build_array('Deploy mechanical excavator and team', 'Log automated report')
        ),
        '[]'::jsonb,
        jsonb_build_array(
            jsonb_build_object(
                'submission_id', 'SUB_' || v_alert.id,
                'raw_text', v_alert.details,
                'normalized_text_en', v_alert.details,
                'language', 'English',
                'geo', v_alert.geo,
                'canonical_location', v_alert.location_label
            )
        ),
        'AI routed and queued for department review.'
    )
    ON CONFLICT (case_id) DO NOTHING;

    -- 3. Delete from proactive_alerts (Completing the move)
    DELETE FROM proactive_alerts WHERE id = p_alert_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
