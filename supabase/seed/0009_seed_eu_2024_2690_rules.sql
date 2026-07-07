-- EU 2024/2690 digital-sector significance rules (spec §17). Detailed
-- thresholds are seeded where the specification provides them (Art. 3 general,
-- Art. 7 cloud, Art. 10 MSP/MSSP). Other article rules are seeded structurally
-- with requires_manual_review — thresholds are never invented.

with rs as (select id from public.regulatory_rule_sets where code = 'EU_2024_2690')
insert into public.regulatory_rules (
  rule_set_id, rule_code, title_sv, description_sv, rule_type,
  applicable_sectors, applicable_subsectors, condition, params, output,
  legal_reference, status, coverage_status, confidence, required_approver_role, sort_order
)
select rs.id, v.rule_code, v.title_sv, v.description_sv, v.rule_type,
       coalesce(v.sectors, '{}')::text[], coalesce(v.subsectors, '{}')::text[],
       v.condition::jsonb, '{}'::jsonb, v.output::jsonb, v.legal_reference,
       'active', coalesce(v.coverage, 'fully_supported'), coalesce(v.confidence, 'high'),
       'ciso', v.sort_order
from rs, (values
  -- Article 3: general significant incident criteria ---------------------------
  (
    'ART3_FINANCIAL_LOSS', 'Art. 3: Direkt ekonomisk förlust > 500 000 EUR eller > 5 % av omsättning',
    'Incidenten har orsakat eller kan orsaka direkt ekonomisk förlust som överstiger 500 000 EUR eller 5 % av föregående års omsättning, beroende på vilket som är lägst.',
    'significance_threshold',
    '{digital_infrastructure,digital_providers,ict_b2b}', null,
    '{"any": [
       {"fact": "direct_financial_loss_eur", "op": "gt", "value": 500000},
       {"fact": "financial_loss_pct_turnover", "op": "gt", "value": 5}
     ]}',
    '{"decision": "significant", "reason_sv": "Direkt ekonomisk förlust överstiger 500 000 EUR eller 5 % av årsomsättningen."}',
    'EU 2024/2690 art. 3.1a', null, null, 10
  ),
  (
    'ART3_TRADE_SECRETS', 'Art. 3: Exfiltrering av företagshemligheter',
    'Företagshemligheter har exfiltrerats.',
    'significance_threshold',
    '{digital_infrastructure,digital_providers,ict_b2b}', null,
    '{"all": [{"fact": "trade_secrets_exfiltrated", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Företagshemligheter har exfiltrerats."}',
    'EU 2024/2690 art. 3.1b', null, null, 20
  ),
  (
    'ART3_DEATH', 'Art. 3: Dödsfall',
    'Incidenten har orsakat eller kan orsaka en persons död.',
    'significance_threshold',
    '{digital_infrastructure,digital_providers,ict_b2b}', null,
    '{"all": [{"fact": "death_caused", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Incidenten har orsakat eller kan orsaka dödsfall."}',
    'EU 2024/2690 art. 3.1c', null, null, 30
  ),
  (
    'ART3_HEALTH_DAMAGE', 'Art. 3: Betydande hälsoskada',
    'Incidenten har orsakat eller kan orsaka betydande skada på en persons hälsa.',
    'significance_threshold',
    '{digital_infrastructure,digital_providers,ict_b2b}', null,
    '{"all": [{"fact": "significant_health_damage", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Incidenten har orsakat eller kan orsaka betydande hälsoskada."}',
    'EU 2024/2690 art. 3.1d', null, null, 40
  ),
  (
    'ART3_MALICIOUS_ACCESS', 'Art. 3: Misstänkt antagonistisk obehörig åtkomst',
    'Misstänkt antagonistisk och obehörig åtkomst till nät- och informationssystem som kan orsaka allvarlig driftstörning.',
    'significance_threshold',
    '{digital_infrastructure,digital_providers,ict_b2b}', null,
    '{"all": [{"fact": "suspected_malicious_unauthorized_access_serious_disruption", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Misstänkt antagonistisk obehörig åtkomst som kan orsaka allvarlig driftstörning."}',
    'EU 2024/2690 art. 3.1e', null, null, 50
  ),
  -- Article 4: recurring incidents ------------------------------------------------
  (
    'ART4_RECURRING', 'Art. 4: Återkommande incidenter',
    'Incidenter som var för sig inte är betydande men som inträffat minst två gånger inom sex månader med samma uppenbara grundorsak och som sammantaget uppfyller kriterierna för betydande incident.',
    'recurring_incident',
    '{digital_infrastructure,digital_providers,ict_b2b}', null,
    '{"all": [
       {"fact": "recurring_same_cause_6_months", "op": "is_true"},
       {"fact": "recurring_combined_meets_criteria", "op": "is_true"}
     ]}',
    '{"decision": "significant", "reason_sv": "Återkommande incidenter med samma grundorsak som sammantaget uppfyller kriterierna."}',
    'EU 2024/2690 art. 4', null, null, 60
  ),
  -- Article 7: cloud computing service providers -----------------------------------
  (
    'ART7_CLOUD_UNAVAILABLE_30M', 'Art. 7: Molntjänst helt otillgänglig > 30 minuter',
    'Molntjänsten är helt otillgänglig i mer än 30 minuter.',
    'significance_threshold',
    '{digital_infrastructure,ict_b2b}', '{cloud}',
    '{"all": [{"fact": "complete_unavailability_minutes", "op": "gt", "value": 30}]}',
    '{"decision": "significant", "reason_sv": "Molntjänsten har varit helt otillgänglig i mer än 30 minuter."}',
    'EU 2024/2690 art. 7a', null, null, 70
  ),
  (
    'ART7_CLOUD_LIMITED_1H', 'Art. 7: Begränsad tillgänglighet > 1h med stor användarpåverkan',
    'Molntjänstens tillgänglighet är begränsad i mer än 1 timme och berör fler än 5 % av användarna i EU eller fler än 1 miljon användare (det lägsta av dessa).',
    'significance_threshold',
    '{digital_infrastructure,ict_b2b}', '{cloud}',
    '{"all": [
       {"fact": "limited_availability_hours", "op": "gt", "value": 1},
       {"fact": "affected_users_over_5pct_or_1m", "op": "is_true"}
     ]}',
    '{"decision": "significant", "reason_sv": "Begränsad tillgänglighet i mer än 1 timme som berör mer än 5 % av EU-användarna eller 1 miljon användare."}',
    'EU 2024/2690 art. 7b', null, null, 80
  ),
  (
    'ART7_CLOUD_CIA', 'Art. 7: Antagonistisk kompromettering av riktighet/konfidentialitet/autenticitet',
    'Antagonistisk kompromettering av uppgifters riktighet, konfidentialitet eller autenticitet i molntjänsten.',
    'significance_threshold',
    '{digital_infrastructure,ict_b2b}', '{cloud}',
    '{"all": [{"fact": "malicious_cia_compromise", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Antagonistisk kompromettering av riktighet, konfidentialitet eller autenticitet."}',
    'EU 2024/2690 art. 7', null, null, 90
  ),
  -- Article 10: MSP / MSSP -----------------------------------------------------------
  (
    'ART10_MSP_UNAVAILABLE_30M', 'Art. 10: MSP/MSSP-tjänst helt otillgänglig > 30 minuter',
    'Den hanterade tjänsten är helt otillgänglig i mer än 30 minuter.',
    'significance_threshold',
    '{ict_b2b}', '{msp,mssp}',
    '{"all": [{"fact": "complete_unavailability_minutes", "op": "gt", "value": 30}]}',
    '{"decision": "significant", "reason_sv": "Tjänsten har varit helt otillgänglig i mer än 30 minuter."}',
    'EU 2024/2690 art. 10a', null, null, 100
  ),
  (
    'ART10_MSP_LIMITED_1H', 'Art. 10: Begränsad tillgänglighet > 1h med stor användarpåverkan',
    'Tjänstens tillgänglighet är begränsad i mer än 1 timme och berör fler än 5 % av användarna i EU eller fler än 1 miljon användare (det lägsta av dessa).',
    'significance_threshold',
    '{ict_b2b}', '{msp,mssp}',
    '{"all": [
       {"fact": "limited_availability_hours", "op": "gt", "value": 1},
       {"fact": "affected_users_over_5pct_or_1m", "op": "is_true"}
     ]}',
    '{"decision": "significant", "reason_sv": "Begränsad tillgänglighet i mer än 1 timme som berör mer än 5 % av EU-användarna eller 1 miljon användare."}',
    'EU 2024/2690 art. 10b', null, null, 110
  ),
  (
    'ART10_MSP_CIA', 'Art. 10: Antagonistisk kompromettering av riktighet/konfidentialitet/autenticitet',
    'Antagonistisk kompromettering av uppgifters riktighet, konfidentialitet eller autenticitet i den hanterade tjänsten.',
    'significance_threshold',
    '{ict_b2b}', '{msp,mssp}',
    '{"all": [{"fact": "malicious_cia_compromise", "op": "is_true"}]}',
    '{"decision": "significant", "reason_sv": "Antagonistisk kompromettering av riktighet, konfidentialitet eller autenticitet."}',
    'EU 2024/2690 art. 10', null, null, 120
  ),
  -- Articles 5, 6, 8, 9, 11, 12, 13, 14: structural rules, manual review ----------------
  (
    'ART5_DNS_REVIEW', 'Art. 5: DNS-tjänsteleverantörer — artikelspecifika kriterier',
    'Artikel 5 innehåller specifika kriterier för DNS-tjänsteleverantörer. Bedöm incidenten manuellt mot artikeln. Systemets trösklar för artikeln är inte seedade.',
    'significance_threshold', '{digital_infrastructure}', '{dns}',
    '{"all": [{"fact": "service_affected", "op": "is_true"}]}',
    '{"decision": "manual_review", "reason_sv": "Artikel 5-kriterier för DNS-tjänster kräver manuell bedömning mot förordningstexten."}',
    'EU 2024/2690 art. 5', 'requires_manual_review', 'low', 130
  ),
  (
    'ART6_TLD_REVIEW', 'Art. 6: Toppdomänsregister — artikelspecifika kriterier',
    'Artikel 6 innehåller specifika kriterier för registreringsenheter för toppdomäner. Bedöm incidenten manuellt mot artikeln.',
    'significance_threshold', '{digital_infrastructure}', '{tld}',
    '{"all": [{"fact": "service_affected", "op": "is_true"}]}',
    '{"decision": "manual_review", "reason_sv": "Artikel 6-kriterier för TLD-register kräver manuell bedömning mot förordningstexten."}',
    'EU 2024/2690 art. 6', 'requires_manual_review', 'low', 140
  ),
  (
    'ART8_DATACENTER_REVIEW', 'Art. 8: Datacentraltjänster — artikelspecifika kriterier',
    'Artikel 8 innehåller specifika kriterier för leverantörer av datacentraltjänster. Bedöm incidenten manuellt mot artikeln.',
    'significance_threshold', '{digital_infrastructure}', '{datacenter}',
    '{"all": [{"fact": "service_affected", "op": "is_true"}]}',
    '{"decision": "manual_review", "reason_sv": "Artikel 8-kriterier för datacentraltjänster kräver manuell bedömning mot förordningstexten."}',
    'EU 2024/2690 art. 8', 'requires_manual_review', 'low', 150
  ),
  (
    'ART9_CDN_REVIEW', 'Art. 9: CDN-leverantörer — artikelspecifika kriterier',
    'Artikel 9 innehåller specifika kriterier för leverantörer av nätverk för innehållsleverans. Bedöm incidenten manuellt mot artikeln.',
    'significance_threshold', '{digital_infrastructure}', '{cdn}',
    '{"all": [{"fact": "service_affected", "op": "is_true"}]}',
    '{"decision": "manual_review", "reason_sv": "Artikel 9-kriterier för CDN kräver manuell bedömning mot förordningstexten."}',
    'EU 2024/2690 art. 9', 'requires_manual_review', 'low', 160
  ),
  (
    'ART11_MARKETPLACE_REVIEW', 'Art. 11: Onlinemarknadsplatser — artikelspecifika kriterier',
    'Artikel 11 innehåller specifika kriterier för onlinemarknadsplatser. Bedöm incidenten manuellt mot artikeln.',
    'significance_threshold', '{digital_providers}', '{online_marketplace}',
    '{"all": [{"fact": "service_affected", "op": "is_true"}]}',
    '{"decision": "manual_review", "reason_sv": "Artikel 11-kriterier för onlinemarknadsplatser kräver manuell bedömning mot förordningstexten."}',
    'EU 2024/2690 art. 11', 'requires_manual_review', 'low', 170
  ),
  (
    'ART12_SEARCH_REVIEW', 'Art. 12: Sökmotorer — artikelspecifika kriterier',
    'Artikel 12 innehåller specifika kriterier för onlinesökmotorer. Bedöm incidenten manuellt mot artikeln.',
    'significance_threshold', '{digital_providers}', '{search_engine}',
    '{"all": [{"fact": "service_affected", "op": "is_true"}]}',
    '{"decision": "manual_review", "reason_sv": "Artikel 12-kriterier för sökmotorer kräver manuell bedömning mot förordningstexten."}',
    'EU 2024/2690 art. 12', 'requires_manual_review', 'low', 180
  ),
  (
    'ART13_SOCIAL_REVIEW', 'Art. 13: Sociala nätverksplattformar — artikelspecifika kriterier',
    'Artikel 13 innehåller specifika kriterier för plattformar för sociala nätverkstjänster. Bedöm incidenten manuellt mot artikeln.',
    'significance_threshold', '{digital_providers}', '{social_network}',
    '{"all": [{"fact": "service_affected", "op": "is_true"}]}',
    '{"decision": "manual_review", "reason_sv": "Artikel 13-kriterier för sociala nätverksplattformar kräver manuell bedömning mot förordningstexten."}',
    'EU 2024/2690 art. 13', 'requires_manual_review', 'low', 190
  ),
  (
    'ART14_TRUST_REVIEW', 'Art. 14: Betrodda tjänster — artikelspecifika kriterier',
    'Artikel 14 innehåller specifika kriterier för tillhandahållare av betrodda tjänster. Bedöm incidenten manuellt mot artikeln och eIDAS-spåret.',
    'significance_threshold', '{digital_infrastructure}', '{trust_services}',
    '{"all": [{"fact": "service_affected", "op": "is_true"}]}',
    '{"decision": "manual_review", "reason_sv": "Artikel 14-kriterier för betrodda tjänster kräver manuell bedömning. Kontrollera även eIDAS-spåret."}',
    'EU 2024/2690 art. 14', 'requires_manual_review', 'low', 200
  ),
  (
    'ANNEX_TECH_REQUIREMENTS', 'Bilaga: tekniska och metodologiska krav',
    'Bilagan till EU 2024/2690 innehåller tekniska och metodologiska cybersäkerhetskrav för berörda aktörer. Kraven mappas till kontrollbiblioteket.',
    'control_requirement', '{digital_infrastructure,digital_providers,ict_b2b}', null,
    null,
    '{"decision": "info", "reason_sv": "Tekniska och metodologiska krav enligt bilagan gäller för verksamheten."}',
    'EU 2024/2690 bilaga', 'partially_supported', 'medium', 210
  )
) as v(rule_code, title_sv, description_sv, rule_type, sectors, subsectors, condition, output, legal_reference, coverage, confidence, sort_order)
on conflict (rule_set_id, rule_code) do nothing;

-- Parallel-track trigger rules (GDPR, eIDAS, contracts, insurance, PTS).
with tracks as (
  select code, id from public.regulatory_rule_sets
  where code in ('GDPR_PERSONAL_DATA_BREACH', 'EIDAS_TRUST_SERVICE', 'CONTRACTUAL_REPORTING', 'CYBER_INSURANCE', 'PTS_RULE_TRACK')
)
insert into public.regulatory_rules (
  rule_set_id, rule_code, title_sv, description_sv, rule_type, condition, params, output,
  legal_reference, status, coverage_status, confidence, sort_order
)
select t.id, v.rule_code, v.title_sv, v.description_sv, 'flag',
       v.condition::jsonb, coalesce(v.params, '{}')::jsonb, v.output::jsonb, v.legal_reference,
       coalesce(v.status, 'active'), coalesce(v.coverage, 'fully_supported'), coalesce(v.confidence, 'high'), 10
from tracks t
join (values
  (
    'GDPR_PERSONAL_DATA_BREACH', 'GDPR_TRACK_TRIGGER', 'Personuppgifter kan vara berörda — GDPR-spår',
    'Om personuppgifter är eller kan vara berörda ska en separat personuppgiftsincidentbedömning göras. Anmälan till IMY normalt inom 72 timmar från kännedom om anmälningspliktig incident.',
    '{"all": [{"fact": "personal_data_possibly_affected", "op": "is_true"}]}',
    null,
    '{"decision": "also_assess", "track": "gdpr", "reason_sv": "Personuppgifter kan vara berörda. GDPR/IMY-bedömning ska göras separat (normalt inom 72 timmar)."}',
    'GDPR art. 33', null, null, null
  ),
  (
    'EIDAS_TRUST_SERVICE', 'EIDAS_TRACK_TRIGGER', 'Betrodd tjänst berörd — eIDAS-spår',
    'Tillhandahållare av betrodda tjänster har ett parallellt rapporteringsspår (eIDAS/PTS) med egna tidsfrister. Spåren slås inte ihop om det inte uttryckligen konfigurerats.',
    '{"all": [{"fact": "is_trust_service_provider", "op": "is_true"}]}',
    '{"deadline_type": "eidas_notification", "hours_from_significant": 24}',
    '{"decision": "also_assess", "track": "eidas", "reason_sv": "Betrodda tjänster: parallellt eIDAS/PTS-rapporteringsspår gäller (24h där tillämpligt)."}',
    'eIDAS art. 19', null, null, null
  ),
  (
    'CONTRACTUAL_REPORTING', 'CONTRACT_TRACK_TRIGGER', 'Avtalade rapporteringskrav kan gälla',
    'Kund- och leverantörsavtal kan innehålla egna incidentrapporteringskrav och tidsfrister. Kontrollera avtalsregistret.',
    '{"any": [
       {"fact": "external_service_affected", "op": "is_true"},
       {"fact": "has_contractual_reporting_obligations", "op": "is_true"}
     ]}',
    null,
    '{"decision": "also_assess", "track": "contracts", "reason_sv": "Avtalade incidentrapporteringskrav kan gälla. Kontrollera kund- och leverantörsavtal."}',
    'Avtalsvillkor', null, null, null
  ),
  (
    'CYBER_INSURANCE', 'INSURANCE_TRACK_TRIGGER', 'Cyberförsäkring kan kräva notifiering',
    'Cyberförsäkringen kan kräva notifiering inom viss tid för att skydda rätten till ersättning.',
    '{"all": [{"fact": "has_cyber_insurance", "op": "is_true"}]}',
    null,
    '{"decision": "also_assess", "track": "insurance", "reason_sv": "Cyberförsäkring finns. Kontrollera försäkringsvillkorens notifieringsfrister."}',
    'Försäkringsvillkor', null, null, null
  ),
  (
    'PTS_RULE_TRACK', 'PTS_TRACK_TRIGGER', 'PTS-sektor — manuell bedömning av sektorspecifika regler',
    'Detta PTS-regelpaket är inte fullt slutligt. Manuell bedömning krävs. För sektorer som omfattas av EU 2024/2690 används den förordningens regler där tillämpligt.',
    '{"all": [{"fact": "is_pts_sector", "op": "is_true"}]}',
    null,
    '{"decision": "also_assess", "track": "pts", "reason_sv": "PTS-regelpaketet är inte fullt slutligt. Manuell bedömning krävs mot PTS sektorsregler."}',
    'PTS föreskrifter (utkast)', 'draft', 'pending_regulatory_guidance', 'low'
  )
) as v(rule_set_code, rule_code, title_sv, description_sv, condition, params, output, legal_reference, status, coverage, confidence)
  on v.rule_set_code = t.code
on conflict (rule_set_id, rule_code) do nothing;

-- eIDAS deadline rule (24h notification track where applicable).
with rs as (select id from public.regulatory_rule_sets where code = 'EIDAS_TRUST_SERVICE')
insert into public.regulatory_rules (
  rule_set_id, rule_code, title_sv, description_sv, rule_type, params, output,
  legal_reference, status, coverage_status, confidence, sort_order
)
select rs.id, 'DL_EIDAS_24H', 'Betrodda tjänster: anmälan inom 24 timmar',
       'För tillhandahållare av betrodda tjänster kan anmälan krävas inom 24 timmar där tillämpligt.',
       'deadline',
       '{"deadline_type": "eidas_notification", "hours_from_significant": 24}'::jsonb,
       '{}'::jsonb, 'eIDAS art. 19; CSL 2025:1506', 'active', 'partially_supported', 'medium', 20
from rs
on conflict (rule_set_id, rule_code) do nothing;
