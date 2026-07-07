-- Rule engine seed: legal sources, rule set statuses/effectivity, regulatory
-- tracks and coverage statuses. Thresholds are seeded in the significance
-- engine seed. No real PII.

insert into public.legal_sources (code, name_sv, name_en, source_type, publisher, official_number, effective_date, status)
values
  ('CSL_2025_1506', 'Cybersäkerhetslag (2025:1506)', 'Cybersecurity Act (2025:1506)', 'law', 'Sveriges riksdag', '2025:1506', '2026-01-15', 'active'),
  ('CSF_2025_1507', 'Cybersäkerhetsförordning (2025:1507)', 'Cybersecurity Ordinance (2025:1507)', 'ordinance', 'Regeringen', '2025:1507', '2026-01-15', 'active'),
  ('MCFFS_2026_1', 'MCFFS 2026:1 Föreskrifter om anmälan och identifiering av väsentliga och viktiga verksamhetsutövare', 'MCFFS 2026:1 Registration and identification', 'agency_regulation', 'MSB', 'MCFFS 2026:1', '2026-02-02', 'active'),
  ('MCFFS_2026_7', 'MCFFS 2026:7 Föreskrifter om rapportering av IT-incidenter för statliga myndigheter', 'MCFFS 2026:7 State agency IT incident reporting', 'agency_regulation', 'MSB', 'MCFFS 2026:7', '2026-07-01', 'active'),
  ('MCFFS_2026_8', 'MCFFS 2026:8 Föreskrifter om incidentrapportering och informationsskyldighet för väsentliga och viktiga verksamhetsutövare', 'MCFFS 2026:8 Incident reporting and information obligations', 'agency_regulation', 'MSB', 'MCFFS 2026:8', '2026-07-01', 'active'),
  ('MCFFS_2026_11', 'MCFFS 2026:11 Föreskrifter om säkerhetsåtgärder och ledningens utbildning', 'MCFFS 2026:11 Security measures and management training', 'agency_regulation', 'MSB', 'MCFFS 2026:11', '2026-10-01', 'pending'),
  ('MCFFS_2026_12', 'MCFFS 2026:12 Föreskrifter om säkerhetsrevision och säkerhetsskanning', 'MCFFS 2026:12 Security audit and security scanning', 'agency_regulation', 'MSB', 'MCFFS 2026:12', '2026-10-01', 'pending'),
  ('PTS_RULE_TRACK', 'PTS sektorspecifika föreskrifter (utkast/pågående)', 'PTS sector-specific rules (draft/pending)', 'agency_regulation', 'PTS', null, null, 'draft'),
  ('EU_2024_2690', 'Kommissionens genomförandeförordning (EU) 2024/2690', 'Commission Implementing Regulation (EU) 2024/2690', 'eu_regulation', 'Europeiska kommissionen', '(EU) 2024/2690', '2024-11-07', 'active'),
  ('GDPR', 'Dataskyddsförordningen (EU) 2016/679', 'GDPR (EU) 2016/679', 'eu_regulation', 'EU', '(EU) 2016/679', '2018-05-25', 'active'),
  ('EIDAS', 'eIDAS-förordningen (EU) nr 910/2014', 'eIDAS Regulation (EU) 910/2014', 'eu_regulation', 'EU', '(EU) 910/2014', '2016-07-01', 'active'),
  ('BEREDSKAPSFORORDNING', 'Förordning om statliga myndigheters beredskap', 'State agency preparedness ordinance', 'ordinance', 'Regeringen', null, null, 'active')
on conflict (code) do nothing;

-- Link rule sets to sources and set statuses/effectivity/coverage.
update public.regulatory_rule_sets rs set
  legal_source_id = ls.id
from public.legal_sources ls
where ls.code = rs.code and rs.legal_source_id is null;

update public.regulatory_rule_sets set
  legal_source_id = (select id from public.legal_sources where code = 'GDPR')
where code = 'GDPR_PERSONAL_DATA_BREACH' and legal_source_id is null;

update public.regulatory_rule_sets set
  legal_source_id = (select id from public.legal_sources where code = 'EIDAS')
where code = 'EIDAS_TRUST_SERVICE' and legal_source_id is null;

update public.regulatory_rule_sets set effective_from = '2026-01-15'
where code in ('CSL_2025_1506', 'CSF_2025_1507');
update public.regulatory_rule_sets set effective_from = '2026-02-02'
where code = 'MCFFS_2026_1';
update public.regulatory_rule_sets set effective_from = '2026-07-01'
where code in ('MCFFS_2026_7', 'MCFFS_2026_8');
update public.regulatory_rule_sets set effective_from = '2026-10-01', status = 'pending_guidance'
where code in ('MCFFS_2026_11', 'MCFFS_2026_12');

-- PTS track: draft, partial coverage, must be reviewed manually.
update public.regulatory_rule_sets set
  status = 'draft',
  coverage_status = 'partially_supported',
  manual_review_required = true,
  requires_update_when_final = true,
  description_sv = 'Detta PTS-regelpaket är inte fullt slutligt. Manuell bedömning krävs.'
where code = 'PTS_RULE_TRACK';

-- Flags: manual review, never automatic decisions.
update public.regulatory_rule_sets set
  status = 'active',
  coverage_status = 'requires_manual_review',
  manual_review_required = true
where code in ('CER_FLAG', 'DORA_FLAG');

update public.regulatory_rule_sets set
  status = 'active',
  coverage_status = 'requires_manual_review',
  manual_review_required = true,
  upload_warning = true,
  description_sv = 'Ladda inte upp säkerhetsskyddsklassificerade uppgifter om inte er deployment och hanteringsprocess är godkänd för den typen av information.'
where code = 'SECURITY_PROTECTION_FLAG';

-- Regulatory tracks (parallel reporting tracks).
insert into public.regulatory_tracks (code, name_sv, name_en, description_sv, authority, rule_set_codes)
values
  ('NIS2_CYBERPORTALEN', 'NIS2-rapportering (Cyberportalen/NCSC)', 'NIS2 reporting (Cyberportalen/NCSC)', 'Upplysning 24h, incidentanmälan 72h, slutrapport och lägesrapport via Cyberportalen.', 'MSB/NCSC', array['CSL_2025_1506', 'MCFFS_2026_8']),
  ('STATE_AGENCY', 'Statlig myndighetsrapportering', 'State agency reporting', 'IT-incidentrapportering för statliga myndigheter enligt MCFFS 2026:7 och beredskapsförordningen, inklusive 6h-varning där tillämpligt.', 'MSB', array['MCFFS_2026_7']),
  ('GDPR_IMY', 'GDPR personuppgiftsincident (IMY)', 'GDPR personal data breach (IMY)', 'Anmälan till IMY normalt inom 72 timmar från kännedom om anmälningspliktig personuppgiftsincident.', 'IMY', array['GDPR_PERSONAL_DATA_BREACH']),
  ('EIDAS_PTS', 'eIDAS/betrodda tjänster', 'eIDAS/trust services', 'Parallellt rapporteringsspår för tillhandahållare av betrodda tjänster.', 'PTS', array['EIDAS_TRUST_SERVICE']),
  ('PTS_DIGITAL', 'PTS/digitala sektorer', 'PTS/digital sectors', 'Sektorspecifikt spår för digital infrastruktur, digitala leverantörer och EU 2024/2690-aktörer.', 'PTS', array['PTS_RULE_TRACK', 'EU_2024_2690']),
  ('CONTRACTUAL', 'Avtalsrapportering', 'Contractual reporting', 'Incidentrapportering enligt kund- och leverantörsavtal.', null, array['CONTRACTUAL_REPORTING']),
  ('INSURANCE', 'Cyberförsäkring', 'Cyber insurance', 'Notifiering till försäkringsgivare och stöd för skadeanmälan.', null, array['CYBER_INSURANCE'])
on conflict (code) do nothing;

-- Coverage per PTS sector: telecom draft; post/courier + space partial pending
-- final rules; EU 2024/2690 sectors fully supported via that rule set.
insert into public.rule_coverage_statuses (rule_set_id, sector_code, coverage_status, manual_review_required, requires_update_when_final, note_sv)
select rs.id, v.sector_code, v.coverage_status, v.manual_review, v.requires_update, v.note_sv
from public.regulatory_rule_sets rs
join (values
  ('PTS_RULE_TRACK', 'digital_infrastructure', 'partially_supported', true, true, 'EU 2024/2690 tillämpas där relevant. PTS-föreskrifter ej slutliga.'),
  ('PTS_RULE_TRACK', 'digital_providers', 'partially_supported', true, true, 'EU 2024/2690 tillämpas där relevant. PTS-föreskrifter ej slutliga.'),
  ('PTS_RULE_TRACK', 'ict_b2b', 'partially_supported', true, true, 'EU 2024/2690 tillämpas där relevant. PTS-föreskrifter ej slutliga.'),
  ('PTS_RULE_TRACK', 'postal_courier', 'pending_regulatory_guidance', true, true, 'Slutliga trösklar saknas. Manuell bedömning krävs.'),
  ('PTS_RULE_TRACK', 'space', 'pending_regulatory_guidance', true, true, 'Slutliga trösklar saknas. Manuell bedömning krävs.'),
  ('PTS_RULE_TRACK', 'telecom', 'pending_regulatory_guidance', true, true, 'PTS telekomföreskrifter är utkast. Manuell bedömning krävs. Uppdateras när slutliga regler publiceras.')
) as v(rule_set_code, sector_code, coverage_status, manual_review, requires_update, note_sv)
  on v.rule_set_code = rs.code
on conflict (rule_set_id, sector_code, subsector_code) do nothing;
