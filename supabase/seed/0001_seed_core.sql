insert into public.regulatory_rule_sets (code, name, status, version)
values
  ('CSL_2025_1506', 'Cybersäkerhetslagen 2025:1506', 'active', '1.0.0'),
  ('CSF_2025_1507', 'Cybersäkerhetsförordningen 2025:1507', 'active', '1.0.0'),
  ('MCFFS_2026_1', 'Anmälan och identifiering', 'active', '1.0.0'),
  ('MCFFS_2026_7', 'Statliga myndigheters it-incidentrapportering', 'active', '1.0.0'),
  ('MCFFS_2026_8', 'Incidentrapportering och informationsskyldighet', 'active', '1.0.0'),
  ('MCFFS_2026_11', 'Säkerhetsåtgärder och ledningens utbildning', 'active', '1.0.0'),
  ('MCFFS_2026_12', 'Säkerhetsrevision och säkerhetsskanning', 'active', '1.0.0'),
  ('PTS_RULE_TRACK', 'PTS-regelspår', 'pending_guidance', '0.1.0'),
  ('EU_2024_2690', 'EU 2024/2690 digitala aktörer', 'active', '1.0.0'),
  ('GDPR_PERSONAL_DATA_BREACH', 'GDPR personuppgiftsincident', 'active', '1.0.0'),
  ('EIDAS_TRUST_SERVICE', 'eIDAS betrodda tjänster', 'active', '1.0.0'),
  ('CONTRACTUAL_REPORTING', 'Avtalsrapportering', 'active', '1.0.0'),
  ('CYBER_INSURANCE', 'Cyberförsäkring', 'active', '1.0.0'),
  ('CER_FLAG', 'CER flaggspår', 'pending_guidance', '0.1.0'),
  ('DORA_FLAG', 'DORA flaggspår', 'pending_guidance', '0.1.0'),
  ('SECURITY_PROTECTION_FLAG', 'Säkerhetsskydd flaggspår', 'manual_review_required', '0.1.0')
on conflict (code) do nothing;

insert into public.sectors (code, name_sv, name_en, annex)
values
  ('energy', 'Energi', 'Energy', 'annex_1'),
  ('transport', 'Transporter', 'Transport', 'annex_1'),
  ('banking', 'Bankverksamhet', 'Banking', 'annex_1'),
  ('financial_market_infrastructure', 'Finansmarknadsinfrastruktur', 'Financial market infrastructure', 'annex_1'),
  ('healthcare', 'Hälso- och sjukvård', 'Health care', 'annex_1'),
  ('drinking_water', 'Dricksvatten', 'Drinking water', 'annex_1'),
  ('waste_water', 'Avloppsvatten', 'Waste water', 'annex_1'),
  ('digital_infrastructure', 'Digital infrastruktur', 'Digital infrastructure', 'annex_1'),
  ('ict_b2b', 'Förvaltning av IKT-tjänster mellan företag', 'ICT service management B2B', 'annex_1'),
  ('public_administration', 'Offentlig förvaltning', 'Public administration', 'annex_1'),
  ('space', 'Rymden', 'Space', 'annex_1'),
  ('postal_courier', 'Post- och budtjänster', 'Postal and courier services', 'annex_2'),
  ('waste_management', 'Avfallshantering', 'Waste management', 'annex_2'),
  ('chemicals', 'Kemikalier', 'Chemicals', 'annex_2'),
  ('food', 'Livsmedel', 'Food', 'annex_2'),
  ('manufacturing', 'Tillverkning', 'Manufacturing', 'annex_2'),
  ('digital_providers', 'Digitala leverantörer', 'Digital providers', 'annex_2'),
  ('research', 'Forskning', 'Research', 'annex_2')
on conflict (code) do nothing;
