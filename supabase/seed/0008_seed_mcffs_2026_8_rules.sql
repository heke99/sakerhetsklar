-- MCFFS 2026:8 significant incident rules (spec §16). Thresholds are seeded
-- data with legal references — editable via the rule admin, never hardcoded.
-- Where an exact final threshold is not provided, the rule is marked
-- requires_manual_review and no threshold is invented.

with rs as (select id from public.regulatory_rule_sets where code = 'MCFFS_2026_8')
insert into public.regulatory_rules (
  rule_set_id, rule_code, title_sv, description_sv, rule_type,
  applicable_sectors, applicable_subsectors, condition, params, output,
  legal_reference, status, coverage_status, confidence, required_approver_role,
  effective_from, sort_order
)
select rs.id, v.rule_code, v.title_sv, v.description_sv, v.rule_type,
       coalesce(v.sectors, '{}')::text[], coalesce(v.subsectors, '{}')::text[],
       v.condition::jsonb, '{}'::jsonb, v.output::jsonb, v.legal_reference,
       coalesce(v.status, 'active'), coalesce(v.coverage, 'fully_supported'),
       coalesce(v.confidence, 'high'), 'ciso', '2026-07-01'::date, v.sort_order
from rs, (values
  -- A. Serious operational disruption (general) -------------------------------
  (
    'GEN_A1_SECTOR_CRITICAL_12H', 'Sektorskritiskt system otillgängligt/nedsatt > 12h',
    'Ett sektorskritiskt system har varit otillgängligt eller haft nedsatt funktion och sektorsverksamheten har varit begränsad i mer än 12 timmar.',
    'significance_threshold', null, null,
    '{"all": [
       {"fact": "sector_critical_system_affected", "op": "is_true"},
       {"fact": "sector_activity_limited_hours", "op": "gt", "value": 12}
     ]}',
    '{"decision": "significant", "reason_sv": "Sektorskritiskt system har varit otillgängligt/nedsatt och sektorsverksamheten begränsad i mer än 12 timmar."}',
    'MCFFS 2026:8 (allvarlig driftstörning)', null, null, null, 10
  ),
  (
    'GEN_A2_WORKAROUND_48H', 'Manuella reservrutiner > 48h',
    'Personalen har behövt använda alternativa arbetssätt/reservrutiner i mer än 48 timmar.',
    'significance_threshold', null, null,
    '{"all": [{"fact": "workaround_hours", "op": "gt", "value": 48}]}',
    '{"decision": "significant", "reason_sv": "Alternativa arbetssätt har krävts i mer än 48 timmar."}',
    'MCFFS 2026:8 (allvarlig driftstörning)', null, null, null, 20
  ),
  (
    'GEN_A3_PROTECTED_INFO', 'Skyddad information i sektorskritiskt system komprometterad',
    'Skyddad information i ett sektorskritiskt system har åtkommits av obehörig, förvanskats eller förstörts.',
    'significance_threshold', null, null,
    '{"all": [{"fact": "protected_info_sector_critical_compromised", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Skyddad information i sektorskritiskt system har åtkommits av obehörig part, förvanskats eller förstörts."}',
    'MCFFS 2026:8 (allvarlig driftstörning)', null, null, null, 30
  ),
  -- B. Economic damage ---------------------------------------------------------
  (
    'GEN_B1_COST_5PCT', 'Ekonomisk skada > 5 % av årsomsättning',
    'Incidentens totala kostnad överstiger 5 % av föregående års omsättning (för offentlig förvaltning: 5 % av föregående års anslag eller totala intäkter). Kostnadskategorier: återställning av information, återställning/ersättning av system, extern incidentrespons, juridik, IT-forensik, sanering, extra personalkostnad, viten och förlorade intäkter.',
    'significance_threshold', null, null,
    '{"all": [{"fact": "incident_cost_exceeds_5pct_turnover", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Incidentens totala kostnad överstiger 5 % av föregående års omsättning/anslag."}',
    'MCFFS 2026:8 (ekonomisk skada)', null, null, null, 40
  ),
  -- C. Damage to other natural/legal persons -----------------------------------
  (
    'GEN_C1_OTHER_PARTY_500', 'Skyddad information för annan part eller minst 500 personer',
    'Skyddad information som tillhör en annan juridisk person eller minst 500 fysiska personer har åtkommits av obehörig, förvanskats eller förstörts.',
    'significance_threshold', null, null,
    '{"all": [{"fact": "protected_info_other_party_or_500_persons", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Skyddad information som rör annan juridisk person eller minst 500 fysiska personer har komprometterats."}',
    'MCFFS 2026:8 (skada för andra)', null, null, null, 50
  ),
  (
    'GEN_C2_ENVIRONMENT', 'Miljöskada',
    'Incidenten har orsakat miljöskada.',
    'significance_threshold', null, null,
    '{"all": [{"fact": "environmental_damage", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Incidenten har orsakat miljöskada."}',
    'MCFFS 2026:8 (skada för andra)', null, null, null, 60
  ),
  (
    'GEN_C3_OTHER_PROVIDER_CRISIS', 'Annan samhällsviktig aktör i kris-/stabsläge',
    'En annan juridisk person som tillhandahåller en viktig samhällsfunktion har gått in i kris- eller stabsläge till följd av incidenten.',
    'significance_threshold', null, null,
    '{"all": [{"fact": "other_provider_crisis_mode", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Annan samhällsviktig aktör har aktiverat kris-/stabsläge på grund av incidenten."}',
    'MCFFS 2026:8 (skada för andra)', null, null, null, 70
  ),
  (
    'GEN_C4_INJURY_DEATH', 'Allvarlig personskada, allvarlig sjukdom eller dödsfall',
    'Incidenten har orsakat allvarlig personskada, allvarlig sjukdom eller dödsfall.',
    'significance_threshold', null, null,
    '{"all": [{"fact": "serious_injury_or_death", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Incidenten har orsakat allvarlig personskada, allvarlig sjukdom eller dödsfall."}',
    'MCFFS 2026:8 (skada för andra)', null, null, null, 80
  ),
  -- D. Recurring incidents ------------------------------------------------------
  (
    'GEN_D1_RECURRING', 'Återkommande incidenter med samma grundorsak',
    'Incidenter som var för sig inte är betydande, har inträffat minst två gånger på sex månader med samma grundorsak och sammanlagd ekonomisk skada som når tröskeln.',
    'recurring_incident', null, null,
    '{"all": [
       {"fact": "recurring_same_cause_6_months", "op": "is_true"},
       {"fact": "recurring_combined_cost_meets_threshold", "op": "is_true"}
     ]}',
    '{"decision": "significant", "reason_sv": "Återkommande incidenter (minst två på sex månader, samma grundorsak) med sammanlagd ekonomisk skada som når tröskeln."}',
    'MCFFS 2026:8 (återkommande incidenter)', null, null, null, 90
  ),
  -- Sector: public administration ----------------------------------------------
  (
    'PUBADM_ACTIVITY_4H', 'Offentlig förvaltning: verksamhet begränsad > 4h',
    'Sektorsverksamheten har varit begränsad i mer än 4 timmar.',
    'significance_threshold', '{public_administration}', null,
    '{"all": [{"fact": "sector_activity_limited_hours", "op": "gt", "value": 4}]}',
    '{"decision": "significant", "reason_sv": "Verksamheten har varit begränsad i mer än 4 timmar."}',
    'MCFFS 2026:8 (offentlig förvaltning)', null, null, null, 100
  ),
  (
    'PUBADM_WORKAROUND_12H', 'Offentlig förvaltning: reservrutiner > 12h',
    'Alternativa arbetssätt har krävts i mer än 12 timmar.',
    'significance_threshold', '{public_administration}', null,
    '{"all": [{"fact": "workaround_hours", "op": "gt", "value": 12}]}',
    '{"decision": "significant", "reason_sv": "Alternativa arbetssätt har krävts i mer än 12 timmar."}',
    'MCFFS 2026:8 (offentlig förvaltning)', null, null, null, 110
  ),
  -- Sector: energy — electricity, district heating/cooling -----------------------
  (
    'ENERGY_EL_USERS_2H', 'Energi (el/fjärrvärme/fjärrkyla): externa tjänster otillgängliga > 2h',
    'Externa tjänster har varit otillgängliga för minst 2 000 slutanvändare eller minst 50 % av slutanvändarna i mer än 2 timmar.',
    'significance_threshold', '{energy}', '{electricity,district_heating_cooling}',
    '{"all": [
       {"any": [
         {"fact": "affected_end_users", "op": "gte", "value": 2000},
         {"fact": "affected_end_users_pct", "op": "gte", "value": 50}
       ]},
       {"fact": "external_service_unavailable_hours", "op": "gt", "value": 2}
     ]}',
    '{"decision": "significant", "reason_sv": "Externa tjänster otillgängliga för minst 2 000 slutanvändare eller 50 % av slutanvändarna i mer än 2 timmar."}',
    'MCFFS 2026:8 (energi: el, fjärrvärme, fjärrkyla)', null, null, null, 120
  ),
  (
    'ENERGY_EL_WORKAROUND_6H', 'Energi (el/fjärrvärme/fjärrkyla): reservrutiner > 6h',
    'Alternativa arbetssätt har krävts i mer än 6 timmar.',
    'significance_threshold', '{energy}', '{electricity,district_heating_cooling}',
    '{"all": [{"fact": "workaround_hours", "op": "gt", "value": 6}]}',
    '{"decision": "significant", "reason_sv": "Alternativa arbetssätt har krävts i mer än 6 timmar."}',
    'MCFFS 2026:8 (energi: el, fjärrvärme, fjärrkyla)', null, null, null, 130
  ),
  (
    'ENERGY_EL_CONTROL_1H', 'Energi (el): styrning/övervakning ej användbar > 1h',
    'Styrning/övervakning av transmissionsnät, regionnät eller elproduktion har inte kunnat användas som avsett i mer än 1 timme.',
    'significance_threshold', '{energy}', '{electricity,district_heating_cooling}',
    '{"all": [{"fact": "control_monitoring_unusable_hours", "op": "gt", "value": 1}]}',
    '{"decision": "significant", "reason_sv": "Styrning/övervakning av transmissionsnät, regionnät eller elproduktion har inte fungerat som avsett i mer än 1 timme."}',
    'MCFFS 2026:8 (energi: el)', null, null, null, 140
  ),
  -- Sector: energy — gas and hydrogen ---------------------------------------------
  (
    'ENERGY_GAS_CONTROL_1H', 'Energi (gas/vätgas): styrning/övervakning ej användbar > 1h',
    'Styrning/övervakning inom systemansvaret har inte kunnat utföras som avsett i mer än 1 timme.',
    'significance_threshold', '{energy}', '{gas,hydrogen}',
    '{"all": [{"fact": "control_monitoring_unusable_hours", "op": "gt", "value": 1}]}',
    '{"decision": "significant", "reason_sv": "Styrning/övervakning inom systemansvaret har inte kunnat utföras som avsett i mer än 1 timme."}',
    'MCFFS 2026:8 (energi: gas, vätgas)', null, null, null, 150
  ),
  (
    'ENERGY_GAS_WORKAROUND_6H', 'Energi (gas/vätgas): reservrutiner > 6h',
    'Alternativa arbetssätt har krävts i mer än 6 timmar.',
    'significance_threshold', '{energy}', '{gas,hydrogen}',
    '{"all": [{"fact": "workaround_hours", "op": "gt", "value": 6}]}',
    '{"decision": "significant", "reason_sv": "Alternativa arbetssätt har krävts i mer än 6 timmar."}',
    'MCFFS 2026:8 (energi: gas, vätgas)', null, null, null, 160
  ),
  -- Sector: energy — oil ------------------------------------------------------------
  (
    'ENERGY_OIL_CONTROL_2H', 'Energi (olja): styrning/övervakning ej användbar > 2h',
    'Styrning/övervakning av pipeline, transmissions-/distributionsnät, produktionsanläggning, raffinaderi, bearbetningsanläggning, lager eller omlastningsanläggning har inte kunnat användas som avsett i mer än 2 timmar.',
    'significance_threshold', '{energy}', '{oil}',
    '{"all": [{"fact": "control_monitoring_unusable_hours", "op": "gt", "value": 2}]}',
    '{"decision": "significant", "reason_sv": "Styrning/övervakning av olje-infrastruktur har inte fungerat som avsett i mer än 2 timmar."}',
    'MCFFS 2026:8 (energi: olja)', null, null, null, 170
  ),
  (
    'ENERGY_OIL_WORKAROUND_6H', 'Energi (olja): reservrutiner > 6h',
    'Alternativa arbetssätt har krävts i mer än 6 timmar.',
    'significance_threshold', '{energy}', '{oil}',
    '{"all": [{"fact": "workaround_hours", "op": "gt", "value": 6}]}',
    '{"decision": "significant", "reason_sv": "Alternativa arbetssätt har krävts i mer än 6 timmar."}',
    'MCFFS 2026:8 (energi: olja)', null, null, null, 180
  ),
  -- Sector: transport — shipping, aviation, road -------------------------------------
  (
    'TRANSPORT_ACTIVITY_1H', 'Transport (sjöfart/luftfart/väg): verksamhet begränsad > 1h',
    'Sektorsverksamheten har varit begränsad i mer än 1 timme.',
    'significance_threshold', '{transport}', '{water,air,road}',
    '{"all": [{"fact": "sector_activity_limited_hours", "op": "gt", "value": 1}]}',
    '{"decision": "significant", "reason_sv": "Sektorsverksamheten har varit begränsad i mer än 1 timme."}',
    'MCFFS 2026:8 (transport: sjöfart, luftfart, väg)', null, null, null, 190
  ),
  (
    'TRANSPORT_EXTERNAL_1H_1000', 'Transport: externa tjänster otillgängliga > 1h och stor påverkan',
    'Externa tjänster har varit otillgängliga i mer än 1 timme och sannolikt påverkat minst 1 000 användare eller ett geografiskt område om minst 10 000 km².',
    'significance_threshold', '{transport}', '{water,air,road}',
    '{"all": [
       {"fact": "external_service_unavailable_hours", "op": "gt", "value": 1},
       {"any": [
         {"fact": "affected_users", "op": "gte", "value": 1000},
         {"fact": "geographic_area_km2", "op": "gte", "value": 10000}
       ]}
     ]}',
    '{"decision": "significant", "reason_sv": "Externa tjänster otillgängliga mer än 1 timme med minst 1 000 berörda användare eller ett område om minst 10 000 km²."}',
    'MCFFS 2026:8 (transport: sjöfart, luftfart, väg)', null, null, null, 200
  ),
  (
    'TRANSPORT_WORKAROUND_6H', 'Transport: reservrutiner > 6h',
    'Alternativa arbetssätt har krävts i mer än 6 timmar.',
    'significance_threshold', '{transport}', null,
    '{"all": [{"fact": "workaround_hours", "op": "gt", "value": 6}]}',
    '{"decision": "significant", "reason_sv": "Alternativa arbetssätt har krävts i mer än 6 timmar."}',
    'MCFFS 2026:8 (transport)', null, null, null, 210
  ),
  (
    'TRANSPORT_RAIL_5PCT', 'Transport (järnväg/kollektivtrafik): > 5 % av planerade avgångar',
    'Sektorsverksamheten har varit begränsad och sannolikt påverkat mer än 5 % av planerade avgångar under ett trafikdygn per transportslag.',
    'significance_threshold', '{transport}', '{rail,public_transport}',
    '{"all": [{"fact": "planned_departures_affected_pct", "op": "gt", "value": 5}]}',
    '{"decision": "significant", "reason_sv": "Mer än 5 % av planerade avgångar under ett trafikdygn har sannolikt påverkats."}',
    'MCFFS 2026:8 (transport: järnväg, kollektivtrafik)', null, null, null, 220
  ),
  -- Sector: healthcare -----------------------------------------------------------------
  (
    'HEALTH_ACTIVITY_1H', 'Vårdgivare: verksamhet begränsad > 1h',
    'Sektorsverksamheten har varit begränsad i mer än 1 timme.',
    'significance_threshold', '{healthcare}', '{healthcare_providers}',
    '{"all": [{"fact": "sector_activity_limited_hours", "op": "gt", "value": 1}]}',
    '{"decision": "significant", "reason_sv": "Vårdverksamheten har varit begränsad i mer än 1 timme."}',
    'MCFFS 2026:8 (vårdgivare)', null, null, null, 230
  ),
  (
    'HEALTH_WORKAROUND_6H', 'Vårdgivare: reservrutiner > 6h',
    'Alternativa arbetssätt har krävts i mer än 6 timmar.',
    'significance_threshold', '{healthcare}', '{healthcare_providers}',
    '{"all": [{"fact": "workaround_hours", "op": "gt", "value": 6}]}',
    '{"decision": "significant", "reason_sv": "Alternativa arbetssätt har krävts i mer än 6 timmar."}',
    'MCFFS 2026:8 (vårdgivare)', null, null, null, 240
  ),
  (
    'HEALTH_PATIENT_SAFETY', 'Vårdgivare: patientsäkerhetsrapportering utlöst',
    'Obligatorisk patientsäkerhetsrapportering har utlösts till följd av incidenten.',
    'significance_threshold', '{healthcare}', '{healthcare_providers}',
    '{"all": [{"fact": "patient_safety_reporting_triggered", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Obligatorisk patientsäkerhetsrapportering har utlösts."}',
    'MCFFS 2026:8 (vårdgivare)', null, null, null, 250
  ),
  (
    'HEALTH_AMBULANCE', 'Vårdgivare: ambulans/ambulanssjukvård kunde inte tillhandahållas',
    'Ambulans eller ambulanssjukvård har inte kunnat tillhandahållas.',
    'significance_threshold', '{healthcare}', '{healthcare_providers}',
    '{"all": [{"fact": "ambulance_unavailable", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Ambulans/ambulanssjukvård har inte kunnat tillhandahållas."}',
    'MCFFS 2026:8 (vårdgivare)', null, null, null, 260
  ),
  -- Sector: drinking water ----------------------------------------------------------------
  (
    'WATER_UNAVAILABLE_4H', 'Dricksvatten: sektorskritiska system otillgängliga/nedsatta > 4h',
    'Sektorskritiska system har varit otillgängliga eller haft nedsatt funktion i mer än 4 timmar.',
    'significance_threshold', '{drinking_water}', null,
    '{"all": [{"fact": "sector_critical_unavailable_hours", "op": "gt", "value": 4}]}',
    '{"decision": "significant", "reason_sv": "Sektorskritiska system har varit otillgängliga/nedsatta i mer än 4 timmar."}',
    'MCFFS 2026:8 (dricksvatten)', null, null, null, 270
  ),
  (
    'WATER_WORKAROUND_8H', 'Dricksvatten: reservrutiner > 8h',
    'Alternativa arbetssätt har krävts i mer än 8 timmar.',
    'significance_threshold', '{drinking_water}', null,
    '{"all": [{"fact": "workaround_hours", "op": "gt", "value": 8}]}',
    '{"decision": "significant", "reason_sv": "Alternativa arbetssätt har krävts i mer än 8 timmar."}',
    'MCFFS 2026:8 (dricksvatten)', null, null, null, 280
  ),
  -- Sector: waste water ---------------------------------------------------------------------
  (
    'WASTEWATER_UNAVAILABLE_4H', 'Avloppsvatten: sektorskritiska system otillgängliga/nedsatta > 4h',
    'Sektorskritiska system har varit otillgängliga eller haft nedsatt funktion i mer än 4 timmar.',
    'significance_threshold', '{waste_water}', null,
    '{"all": [{"fact": "sector_critical_unavailable_hours", "op": "gt", "value": 4}]}',
    '{"decision": "significant", "reason_sv": "Sektorskritiska system har varit otillgängliga/nedsatta i mer än 4 timmar."}',
    'MCFFS 2026:8 (avloppsvatten)', null, null, null, 290
  ),
  (
    'WASTEWATER_WORKAROUND_8H', 'Avloppsvatten: reservrutiner > 8h',
    'Alternativa arbetssätt har krävts i mer än 8 timmar.',
    'significance_threshold', '{waste_water}', null,
    '{"all": [{"fact": "workaround_hours", "op": "gt", "value": 8}]}',
    '{"decision": "significant", "reason_sv": "Alternativa arbetssätt har krävts i mer än 8 timmar."}',
    'MCFFS 2026:8 (avloppsvatten)', null, null, null, 300
  ),
  -- Sectors without seeded final thresholds: manual review, never guessed ---------------------
  (
    'SECTOR_THRESHOLD_MISSING', 'Sektorströskel ej fastställd — manuell bedömning',
    'För denna sektor finns ingen fastställd tröskel seedad i systemet. Bedöm incidenten manuellt mot de allmänna kriterierna och sektorns föreskrifter. Tröskeln uppdateras när officiell källa finns.',
    'significance_threshold',
    '{banking,financial_market_infrastructure,waste_management,chemicals,food,manufacturing,research,space,postal_courier}',
    null,
    '{"all": [{"fact": "sector_critical_system_affected", "op": "is_true"}]}',
    '{"decision": "manual_review", "reason_sv": "Sektorspecifik tröskel är inte fastställd i systemet. Manuell bedömning krävs mot allmänna kriterier och sektorsföreskrifter."}',
    'MCFFS 2026:8', 'active', 'requires_manual_review', 'low', 310
  )
) as v(rule_code, title_sv, description_sv, rule_type, sectors, subsectors, condition, output, legal_reference, status, coverage, confidence, sort_order)
on conflict (rule_set_id, rule_code) do nothing;

-- Deadline rules (used by the deadline engine).
with rs as (select id from public.regulatory_rule_sets where code = 'MCFFS_2026_8')
insert into public.regulatory_rules (
  rule_set_id, rule_code, title_sv, description_sv, rule_type, condition, params,
  output, legal_reference, status, coverage_status, confidence, effective_from, sort_order
)
select rs.id, v.rule_code, v.title_sv, v.description_sv, 'deadline', null,
       v.params::jsonb, '{}'::jsonb, v.legal_reference, 'active', 'fully_supported',
       'high', '2026-07-01'::date, v.sort_order
from rs, (values
  ('DL_EARLY_WARNING_24H', 'Upplysning inom 24 timmar', 'Tidig upplysning ska lämnas utan onödigt dröjsmål och senast inom 24 timmar från att incidenten identifierats som betydande.', '{"deadline_type": "early_warning", "hours_from_significant": 24}', 'CSL 2025:1506; MCFFS 2026:8', 10),
  ('DL_NOTIFICATION_72H', 'Incidentanmälan inom 72 timmar', 'Incidentanmälan ska lämnas senast inom 72 timmar från att incidenten identifierats som betydande.', '{"deadline_type": "incident_notification", "hours_from_significant": 72}', 'CSL 2025:1506; MCFFS 2026:8', 20),
  ('DL_FINAL_REPORT_1M', 'Slutrapport inom en månad', 'Slutrapport ska lämnas senast en månad efter incidentanmälan.', '{"deadline_type": "final_report", "days_from_notification": 30}', 'CSL 2025:1506; MCFFS 2026:8', 30)
) as v(rule_code, title_sv, description_sv, params, legal_reference, sort_order)
on conflict (rule_set_id, rule_code) do nothing;

-- State agency track (MCFFS 2026:7): 6h warning + 72h + final/situation report.
with rs as (select id from public.regulatory_rule_sets where code = 'MCFFS_2026_7')
insert into public.regulatory_rules (
  rule_set_id, rule_code, title_sv, description_sv, rule_type, condition, params,
  output, legal_reference, status, coverage_status, confidence, effective_from, sort_order
)
select rs.id, v.rule_code, v.title_sv, v.description_sv, v.rule_type,
       v.condition::jsonb, v.params::jsonb, v.output::jsonb, v.legal_reference,
       'active', v.coverage, v.confidence, '2026-07-01'::date, v.sort_order
from rs, (values
  (
    'SA_TRACK_APPLIES', 'Statlig myndighet: separat rapporteringsspår',
    'Statliga myndigheter rapporterar IT-incidenter enligt MCFFS 2026:7 och beredskapsförordningen som ett separat spår. Rapporterna slås inte ihop med NIS2-rapporter om det inte uttryckligen konfigurerats.',
    'flag',
    '{"all": [{"fact": "entity_type", "op": "eq", "value": "state_agency"}]}',
    '{}',
    '{"decision": "also_assess", "track": "state_agency", "reason_sv": "Statliga myndigheter har ett eget it-incidentrapporteringsspår (MCFFS 2026:7)."}',
    'MCFFS 2026:7; beredskapsförordningen', 'fully_supported', 'high', 10
  ),
  (
    'SA_DL_WARNING_6H', 'Statlig myndighet: varning inom 6 timmar',
    'Varning enligt beredskapsförordningens spår ska där tillämpligt lämnas inom 6 timmar.',
    'deadline', null,
    '{"deadline_type": "state_agency_warning", "hours_from_significant": 6}',
    '{}',
    'MCFFS 2026:7; beredskapsförordningen', 'partially_supported', 'medium', 20
  ),
  (
    'SA_DL_NOTIFICATION_72H', 'Statlig myndighet: incidentanmälan inom 72 timmar',
    'Incidentanmälan enligt MCFFS 2026:7 inom 72 timmar.',
    'deadline', null,
    '{"deadline_type": "state_agency_notification", "hours_from_significant": 72}',
    '{}',
    'MCFFS 2026:7', 'fully_supported', 'high', 30
  ),
  (
    'SA_DL_FINAL_1M', 'Statlig myndighet: slutrapport eller lägesrapport inom en månad',
    'Slutrapport eller lägesrapport enligt spårets egna regler inom en månad.',
    'deadline', null,
    '{"deadline_type": "state_agency_final_report", "days_from_notification": 30}',
    '{}',
    'MCFFS 2026:7', 'fully_supported', 'high', 40
  )
) as v(rule_code, title_sv, description_sv, rule_type, condition, params, output, legal_reference, coverage, confidence, sort_order)
on conflict (rule_set_id, rule_code) do nothing;
