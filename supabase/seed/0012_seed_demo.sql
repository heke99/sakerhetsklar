-- Demo/seed tenants and incidents (spec §44, §50). All data is fictional —
-- no real PII. Contacts use function mailboxes on example.test domains.

-- ---------------------------------------------------------------------------
-- Demo tenants.
-- ---------------------------------------------------------------------------
insert into public.tenants (id, name, organization_number, slug, organization_type, deployment_model, plan, status, onboarding_status, primary_contact_name, primary_contact_email)
values
  ('d0000000-0000-0000-0000-000000000001', 'Demo Vatten AB (kommunalt VA-bolag)', '556000-0001', 'demo-vatten', 'municipal_company', 'single_tenant', 'business', 'active', 'complete', 'Säkerhetsfunktionen', 'sakerhet@demovatten.example.test'),
  ('d0000000-0000-0000-0000-000000000002', 'Demo Energi AB', '556000-0002', 'demo-energi', 'private_company', 'multi_tenant', 'enterprise', 'active', 'complete', 'CISO-funktionen', 'ciso@demoenergi.example.test'),
  ('d0000000-0000-0000-0000-000000000003', 'Demo Moln & MSP AB', '556000-0003', 'demo-msp', 'private_company', 'multi_tenant', 'business', 'active', 'in_progress', 'Driftjouren', 'drift@demomsp.example.test'),
  ('d0000000-0000-0000-0000-000000000004', 'Demo Myndigheten', '202100-0004', 'demo-myndighet', 'state_agency', 'single_tenant', 'enterprise', 'active', 'complete', 'It-incidentfunktionen', 'incident@demomyndighet.example.test'),
  ('d0000000-0000-0000-0000-000000000005', 'Demo Handel AB (SaaS-kund)', '556000-0005', 'demo-handel', 'private_company', 'multi_tenant', 'starter', 'active', 'not_started', 'Kontakt', 'kontakt@demohandel.example.test')
on conflict (id) do nothing;

insert into public.tenant_settings (tenant_id)
select id from public.tenants where slug like 'demo-%'
on conflict (tenant_id) do nothing;

insert into public.control_plane_tenants (tenant_id, environment, product_version, rule_package_version, migration_status, health_status, production_readiness, open_incident_count, potential_significant_incident_count, missed_deadline_count, last_activity_at)
values
  ('d0000000-0000-0000-0000-000000000001', 'prod', '1.0.0', '1.0.0', 'up_to_date', 'healthy', 'ready', 2, 1, 1, now()),
  ('d0000000-0000-0000-0000-000000000002', 'prod', '1.0.0', '1.0.0', 'up_to_date', 'healthy', 'ready', 1, 0, 0, now()),
  ('d0000000-0000-0000-0000-000000000003', 'prod', '1.0.0', '1.0.0', 'up_to_date', 'degraded', 'in_progress', 1, 1, 0, now()),
  ('d0000000-0000-0000-0000-000000000004', 'prod', '1.0.0', '1.0.0', 'up_to_date', 'healthy', 'ready', 1, 0, 0, now()),
  ('d0000000-0000-0000-0000-000000000005', 'prod', '1.0.0', null, 'up_to_date', 'healthy', 'not_started', 0, 0, 0, now())
on conflict (tenant_id) do nothing;

insert into public.tenant_domains (tenant_id, domain, environment, is_primary, status)
values
  ('d0000000-0000-0000-0000-000000000001', 'demo-vatten.sakerhetsklar.se', 'prod', true, 'active'),
  ('d0000000-0000-0000-0000-000000000002', 'demo-energi.sakerhetsklar.se', 'prod', true, 'active'),
  ('d0000000-0000-0000-0000-000000000003', 'demo-msp.sakerhetsklar.se', 'prod', true, 'active'),
  ('d0000000-0000-0000-0000-000000000004', 'demo-myndighet.sakerhetsklar.se', 'prod', true, 'active')
on conflict (domain) do nothing;

-- Rule packages per tenant.
insert into public.tenant_rule_package_versions (tenant_id, rule_set_code, version, status)
select t.tenant_id, v.code, rs.version, 'active'
from (values
  ('d0000000-0000-0000-0000-000000000001'::uuid),
  ('d0000000-0000-0000-0000-000000000002'::uuid),
  ('d0000000-0000-0000-0000-000000000003'::uuid),
  ('d0000000-0000-0000-0000-000000000004'::uuid)
) as t(tenant_id)
cross join (values ('CSL_2025_1506'), ('CSF_2025_1507'), ('MCFFS_2026_1'), ('MCFFS_2026_8'), ('GDPR_PERSONAL_DATA_BREACH'), ('CONTRACTUAL_REPORTING'), ('CYBER_INSURANCE')) as v(code)
join public.regulatory_rule_sets rs on rs.code = v.code
on conflict (tenant_id, rule_set_code, version) do nothing;

insert into public.tenant_rule_package_versions (tenant_id, rule_set_code, version, status)
select 'd0000000-0000-0000-0000-000000000003', code, version, 'active'
from public.regulatory_rule_sets where code in ('EU_2024_2690', 'PTS_RULE_TRACK')
on conflict (tenant_id, rule_set_code, version) do nothing;

insert into public.tenant_rule_package_versions (tenant_id, rule_set_code, version, status)
select 'd0000000-0000-0000-0000-000000000004', code, version, 'active'
from public.regulatory_rule_sets where code = 'MCFFS_2026_7'
on conflict (tenant_id, rule_set_code, version) do nothing;

-- Scope results.
insert into public.scope_assessments (id, tenant_id, status, completed_at)
values
  ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'completed', now()),
  ('d1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'completed', now()),
  ('d1000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'completed', now()),
  ('d1000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', 'completed', now())
on conflict (id) do nothing;

insert into public.scope_results (assessment_id, tenant_id, likely_covered, classification, sectors, subsectors, supervisory_authorities, active_rule_packages, pending_rule_packages, reasons, confidence, next_steps)
values
  ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'yes', 'important',
   array['drinking_water', 'waste_water'], '{}', array['livsmedelsverket'],
   array['CSL_2025_1506', 'CSF_2025_1507', 'MCFFS_2026_1', 'MCFFS_2026_8', 'GDPR_PERSONAL_DATA_BREACH'],
   array['MCFFS_2026_11', 'MCFFS_2026_12'],
   '["Medelstor verksamhetsutövare i högkritisk sektor (bilaga 1)."]'::jsonb, 'high',
   '["Registrera verksamheten enligt MCFFS 2026:1.", "Utse incidentroller."]'::jsonb),
  ('d1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'yes', 'essential',
   array['energy'], array['electricity', 'district_heating_cooling'], array['energimyndigheten'],
   array['CSL_2025_1506', 'CSF_2025_1507', 'MCFFS_2026_1', 'MCFFS_2026_8'],
   array['MCFFS_2026_11', 'MCFFS_2026_12'],
   '["Stor verksamhetsutövare i högkritisk sektor (bilaga 1)."]'::jsonb, 'high',
   '["Dokumentera sektorskritiska styrsystem."]'::jsonb),
  ('d1000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'yes', 'important',
   array['ict_b2b', 'digital_infrastructure'], array['msp', 'cloud'], array['pts'],
   array['CSL_2025_1506', 'MCFFS_2026_1', 'MCFFS_2026_8', 'EU_2024_2690'],
   array['PTS_RULE_TRACK', 'MCFFS_2026_11', 'MCFFS_2026_12'],
   '["Medelstor MSP/molnleverantör. EU 2024/2690 gäller. PTS-föreskrifter är utkast — manuell bedömning krävs."]'::jsonb, 'medium',
   '["Gör manuell bedömning mot PTS-regelspåret."]'::jsonb),
  ('d1000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', 'yes', 'public',
   array['public_administration'], array['state_agency'], array['lansstyrelserna'],
   array['CSL_2025_1506', 'MCFFS_2026_7', 'MCFFS_2026_8'],
   array['MCFFS_2026_11'],
   '["Statlig myndighet — offentlig förvaltning med eget it-incidentrapporteringsspår (MCFFS 2026:7)."]'::jsonb, 'high',
   '["Säkerställ 6h-varningsrutin enligt beredskapsspåret."]'::jsonb)
on conflict do nothing;

-- Systems, services and vendors for the VA company.
insert into public.systems (id, tenant_id, name, system_type, environment, owner_name, sector_critical, rto_hours, rpo_hours, backup_status, personal_data)
values
  ('d2000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'SCADA Vattenverk Nord', 'SCADA/OT', 'production', 'Driftchef VA', true, 4, 1, 'ok', false),
  ('d2000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Kundportal VA', 'Webbportal', 'production', 'It-samordnare', false, 24, 12, 'ok', true),
  ('d2000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000002', 'Driftcentral El (styr/övervakning)', 'SCADA/OT', 'production', 'Driftchef El', true, 1, 0.5, 'ok', false),
  ('d2000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000003', 'Molnplattform Kund-VM', 'IaaS-plattform', 'production', 'Plattformschef', true, 0.5, 0.25, 'ok', true)
on conflict (id) do nothing;

insert into public.critical_services (id, tenant_id, name, sector_code, is_external, service_owner_name, affected_users_estimate, rto_hours, manual_workaround_available, manual_workaround_max_hours)
values
  ('d3000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Dricksvattenförsörjning tätort', 'drinking_water', true, 'VA-chef', 45000, 4, true, 8),
  ('d3000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000002', 'Eldistribution region syd', 'energy', true, 'Nätchef', 120000, 2, true, 6),
  ('d3000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000003', 'Managed hosting för kommunkunder', 'ict_b2b', true, 'Leveranschef', 30000, 1, false, null)
on conflict (id) do nothing;

insert into public.critical_service_systems (critical_service_id, system_id)
values
  ('d3000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001'),
  ('d3000000-0000-0000-0000-000000000011', 'd2000000-0000-0000-0000-000000000011'),
  ('d3000000-0000-0000-0000-000000000021', 'd2000000-0000-0000-0000-000000000021')
on conflict do nothing;

insert into public.vendors (id, tenant_id, name, organization_number, incident_contact_name, incident_contact_email, has_24_7_contact, personal_data_processor, dpa_exists, risk_rating)
values
  ('d4000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Demo Automation AB (SCADA-support)', '556000-1001', 'Supportjouren', 'jour@demoautomation.example.test', true, false, null, 'high'),
  ('d4000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Demo Hosting AB', '556000-1002', null, null, false, true, true, 'medium'),
  ('d4000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000003', 'Demo Datacenter Nord AB', '556000-1021', 'NOC', 'noc@demodc.example.test', true, false, true, 'high')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Demo incidents (spec §44): five flows.
-- ---------------------------------------------------------------------------

-- 1. Drinking water outage — significant/reportable with 24h report draft.
insert into public.incidents (id, tenant_id, reference, title, description, status, severity, incident_type, is_ongoing, suspected_malicious, personal_data_possibly_affected, incident_started_at, incident_detected_at, incident_known_at, identified_as_significant_at, significance_status, detection_method)
values (
  'd5000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
  'INC-2026-0001', 'SCADA otillgängligt — dricksvattenstyrning nere',
  'Styrsystemet för vattenverk Nord slutade svara 06:10. Manuell drift aktiverad 07:00. Kritisk dricksvattentjänst påverkad.',
  'investigating', 'critical', 'ot_incident', true, false, false,
  now() - interval '7 hours', now() - interval '6 hours', now() - interval '6 hours',
  now() - interval '2 hours', 'significant_reportable', 'Larm från övervakning'
)
on conflict (tenant_id, reference) do nothing;

insert into public.incident_system_impacts (tenant_id, incident_id, system_id, impact_type, started_at)
values ('d0000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'unavailable', now() - interval '7 hours')
on conflict do nothing;

insert into public.incident_service_impacts (tenant_id, incident_id, critical_service_id, impact_type, affected_users_estimate, started_at, manual_workaround_active, manual_workaround_started_at)
values ('d0000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'degraded', 45000, now() - interval '7 hours', true, now() - interval '6 hours')
on conflict do nothing;

insert into public.incident_significance_assessments (tenant_id, incident_id, facts, recommendation, matched_rules, reasons, legal_references, confidence, required_approver_roles, next_steps, deadline_definitions)
values (
  'd0000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001',
  '{"sector_critical_unavailable_hours": 6, "workaround_hours": 6, "sector_critical_system_affected": true}'::jsonb,
  'significant_reportable',
  '[{"ruleSetCode": "MCFFS_2026_8", "ruleCode": "WATER_UNAVAILABLE_4H", "titleSv": "Dricksvatten: sektorskritiska system otillgängliga/nedsatta > 4h", "reasonSv": "Sektorskritiska system har varit otillgängliga/nedsatta i mer än 4 timmar.", "legalReference": "MCFFS 2026:8 (dricksvatten)", "coverageStatus": "fully_supported", "status": "active"}]'::jsonb,
  '["Sektorskritiska system har varit otillgängliga/nedsatta i mer än 4 timmar."]'::jsonb,
  '["MCFFS 2026:8 (dricksvatten)"]'::jsonb,
  'high', array['ciso', 'legal_compliance'],
  '["CISO granskar bedömningen.", "Juridik godkänner rapporteringsbeslutet.", "Skapa 24h-upplysning i rapportmodulen."]'::jsonb,
  '[{"deadlineType": "early_warning", "hoursFromSignificant": 24, "titleSv": "Upplysning inom 24 timmar", "legalReference": "CSL 2025:1506; MCFFS 2026:8"}, {"deadlineType": "incident_notification", "hoursFromSignificant": 72, "titleSv": "Incidentanmälan inom 72 timmar", "legalReference": "CSL 2025:1506; MCFFS 2026:8"}]'::jsonb
)
on conflict do nothing;

insert into public.incident_deadlines (tenant_id, incident_id, deadline_type, due_at, status, legal_reference)
values
  ('d0000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'early_warning', now() + interval '22 hours', 'pending', 'CSL 2025:1506; MCFFS 2026:8'),
  ('d0000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'incident_notification', now() + interval '70 hours', 'pending', 'CSL 2025:1506; MCFFS 2026:8')
on conflict (incident_id, deadline_type, track_code) do nothing;

insert into public.incident_reports (id, tenant_id, incident_id, report_stage, status, due_at)
values ('d6000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'early_warning_24h', 'draft', now() + interval '22 hours')
on conflict (incident_id, report_stage, track_code) do nothing;

-- 2. Ransomware at the energy company — significant, war room active.
insert into public.incidents (id, tenant_id, reference, title, description, status, severity, incident_type, is_ongoing, suspected_malicious, personal_data_possibly_affected, incident_started_at, incident_detected_at, identified_as_significant_at, significance_status)
values (
  'd5000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002',
  'INC-2026-0001', 'Ransomware i administrativt nät',
  'Krypterande skadlig kod upptäckt på filservrar. OT-nätet segmenterat och opåverkat. Utredning pågår med extern IR-partner.',
  'contained', 'critical', 'ransomware', true, true, true,
  now() - interval '2 days', now() - interval '47 hours', now() - interval '46 hours', 'significant_reportable'
)
on conflict (tenant_id, reference) do nothing;

insert into public.incident_war_rooms (tenant_id, incident_id, status)
values ('d0000000-0000-0000-0000-000000000002', 'd5000000-0000-0000-0000-000000000002', 'active')
on conflict (incident_id) do nothing;

-- 3. Cloud outage at the MSP — manual review (PTS/EU track).
insert into public.incidents (id, tenant_id, reference, title, description, status, severity, incident_type, is_ongoing, incident_started_at, incident_detected_at, significance_status)
values (
  'd5000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003',
  'INC-2026-0001', 'Molnplattform otillgänglig 40 minuter',
  'Total otillgänglighet i 40 minuter efter nätverksfel i datacenter. EU 2024/2690 art. 7-tröskel (30 min) överskriden. PTS-spår kräver manuell bedömning.',
  'resolved', 'high', 'outage', false,
  now() - interval '1 day', now() - interval '1 day', 'manual_review_required'
)
on conflict (tenant_id, reference) do nothing;

-- 4. State agency incident.
insert into public.incidents (id, tenant_id, reference, title, description, status, severity, incident_type, is_ongoing, incident_started_at, incident_detected_at, identified_as_significant_at, significance_status)
values (
  'd5000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004',
  'INC-2026-0001', 'Överbelastningsattack mot e-tjänsteplattform',
  'DDoS mot myndighetens e-tjänster. Statligt rapporteringsspår (MCFFS 2026:7) med 6h-varning aktiverat.',
  'investigating', 'high', 'ddos', true,
  now() - interval '5 hours', now() - interval '4 hours', now() - interval '3 hours', 'significant_reportable'
)
on conflict (tenant_id, reference) do nothing;

insert into public.incident_deadlines (tenant_id, incident_id, deadline_type, due_at, status, legal_reference)
values ('d0000000-0000-0000-0000-000000000004', 'd5000000-0000-0000-0000-000000000004', 'state_agency_warning', now() + interval '3 hours', 'pending', 'MCFFS 2026:7')
on conflict (incident_id, deadline_type, track_code) do nothing;

insert into public.incident_regulatory_tracks (tenant_id, incident_id, track_code, status, reason)
values ('d0000000-0000-0000-0000-000000000004', 'd5000000-0000-0000-0000-000000000004', 'STATE_AGENCY', 'reporting_required', 'Statlig myndighet — eget rapporteringsspår.')
on conflict (incident_id, track_code) do nothing;

-- 5. Personal data breach at the VA company (GDPR track).
insert into public.incidents (id, tenant_id, reference, title, description, status, severity, incident_type, is_ongoing, personal_data_possibly_affected, incident_started_at, incident_detected_at, significance_status)
values (
  'd5000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001',
  'INC-2026-0002', 'Felkonfigurerad kundportal exponerade kunduppgifter',
  'Kundportalens API exponerade namn och adress för inloggade användare med fel behörighet. Ca 1 200 registrerade berörda.',
  'resolved', 'medium', 'data_leak', false, true,
  now() - interval '3 days', now() - interval '3 days', 'not_reportable'
)
on conflict (tenant_id, reference) do nothing;

insert into public.incident_personal_data_assessments (tenant_id, incident_id, status, personal_data_involved, data_categories, data_subjects_count, disclosed, risk_to_rights, high_risk, imy_notification_required, awareness_at, imy_deadline_at)
values (
  'd0000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000005',
  'report_required', true, array['namn', 'adress', 'kundnummer'], 1200, true, true, false, true,
  now() - interval '3 days', now() - interval '3 days' + interval '72 hours'
)
on conflict (incident_id) do nothing;

insert into public.incident_regulatory_tracks (tenant_id, incident_id, track_code, status, reason)
values ('d0000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000005', 'GDPR_IMY', 'reporting_required', 'Personuppgifter röjda — IMY-anmälan krävs.')
on conflict (incident_id, track_code) do nothing;

-- 6. Late reporting case at the VA company: missed 24h deadline.
insert into public.incidents (id, tenant_id, reference, title, description, status, severity, incident_type, is_ongoing, incident_started_at, incident_detected_at, identified_as_significant_at, significance_status)
values (
  'd5000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000001',
  'INC-2026-0003', 'Avloppspumpstation utslagen — sen upplysning',
  'Sektorskritiskt styrsystem för avloppspumpstationer otillgängligt i 9 timmar. Betydelsen identifierades sent och 24h-upplysningen missades.',
  'closed', 'high', 'ot_incident', false,
  now() - interval '6 days', now() - interval '6 days', now() - interval '5 days', 'significant_reportable'
)
on conflict (tenant_id, reference) do nothing;

insert into public.incident_deadlines (id, tenant_id, incident_id, deadline_type, due_at, status, legal_reference)
values (
  'd7000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000001',
  'd5000000-0000-0000-0000-000000000006', 'early_warning',
  now() - interval '4 days', 'missed', 'CSL 2025:1506; MCFFS 2026:8'
)
on conflict (incident_id, deadline_type, track_code) do nothing;

insert into public.late_reporting_records (tenant_id, incident_id, deadline_id, deadline_type, due_at, why_late, why_not_identified_earlier, prevention_actions, status)
values (
  'd0000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000006',
  'd7000000-0000-0000-0000-000000000006', 'early_warning', now() - interval '4 days',
  'Incidenten bedömdes initialt som ett lokalt driftproblem och eskalerades inte till incidentorganisationen.',
  'Tröskeln för avloppsvatten (>4h) var inte känd av jourpersonalen.',
  'Utbildning av jourpersonal i betydande-trösklar samt automatisk bedömningspåminnelse vid OT-larm.',
  'explanation_drafted'
)
on conflict do nothing;
