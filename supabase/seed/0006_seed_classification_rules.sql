-- Coverage/classification rules for CSL 2025:1506 (evaluated by the rule
-- engine — never hardcoded in the frontend). Outputs drive the scope engine.

with rs as (
  select id from public.regulatory_rule_sets where code = 'CSL_2025_1506'
)
insert into public.regulatory_rules (
  rule_set_id, rule_code, title_sv, description_sv, rule_type,
  applicable_sectors, condition, params, output, legal_reference,
  status, coverage_status, confidence, required_approver_role, effective_from, sort_order
)
select rs.id, v.rule_code, v.title_sv, v.description_sv, v.rule_type,
       coalesce(v.sectors, '{}')::text[], v.condition::jsonb, '{}'::jsonb, v.output::jsonb,
       v.legal_reference, v.status, v.coverage_status, v.confidence,
       v.approver, '2026-01-15'::date, v.sort_order
from rs, (values
  (
    'CSL_PUBLIC_ADMIN', 'Offentlig förvaltning omfattas',
    'Statliga myndigheter, kommuner och regioner omfattas som offentlig förvaltning.',
    'classification', null,
    '{"any": [
       {"fact": "entity_type", "op": "in", "value": ["municipality", "region", "state_agency", "other_public_body"]}
     ]}',
    '{"decision": "classification", "value": "public", "priority": 90, "likely_covered": "yes"}',
    'CSL 2025:1506; NIS2 art. 2.2', 'active', 'fully_supported', 'high', 'legal_compliance', 10
  ),
  (
    'CSL_ANNEX1_LARGE', 'Väsentlig verksamhetsutövare — bilaga 1, stor',
    'Stor verksamhetsutövare i en högkritisk sektor (bilaga 1) klassificeras som väsentlig.',
    'classification', null,
    '{"all": [
       {"fact": "has_annex1_sector", "op": "is_true"},
       {"fact": "size_class", "op": "eq", "value": "large"}
     ]}',
    '{"decision": "classification", "value": "essential", "priority": 80, "likely_covered": "yes"}',
    'CSL 2025:1506; NIS2 art. 3.1', 'active', 'fully_supported', 'high', 'legal_compliance', 20
  ),
  (
    'CSL_ANNEX1_MEDIUM', 'Viktig verksamhetsutövare — bilaga 1, medelstor',
    'Medelstor verksamhetsutövare i en högkritisk sektor (bilaga 1) klassificeras som viktig.',
    'classification', null,
    '{"all": [
       {"fact": "has_annex1_sector", "op": "is_true"},
       {"fact": "size_class", "op": "eq", "value": "medium"}
     ]}',
    '{"decision": "classification", "value": "important", "priority": 70, "likely_covered": "yes"}',
    'CSL 2025:1506; NIS2 art. 3.2', 'active', 'fully_supported', 'high', 'legal_compliance', 30
  ),
  (
    'CSL_ANNEX2_MEDIUM_LARGE', 'Viktig verksamhetsutövare — bilaga 2',
    'Medelstor eller stor verksamhetsutövare i en annan kritisk sektor (bilaga 2) klassificeras som viktig.',
    'classification', null,
    '{"all": [
       {"fact": "has_annex2_sector", "op": "is_true"},
       {"fact": "size_class", "op": "in", "value": ["medium", "large"]}
     ]}',
    '{"decision": "classification", "value": "important", "priority": 60, "likely_covered": "yes"}',
    'CSL 2025:1506; NIS2 art. 3.2', 'active', 'fully_supported', 'high', 'legal_compliance', 40
  ),
  (
    'CSL_DNS_ANY_SIZE', 'DNS-tjänsteleverantörer oavsett storlek',
    'DNS-tjänsteleverantörer (utom rotnamnsservrar) klassificeras som väsentliga oavsett storlek.',
    'classification', '{digital_infrastructure}',
    '{"all": [{"fact": "is_dns_provider", "op": "is_true"}]}',
    '{"decision": "classification", "value": "essential", "priority": 85, "likely_covered": "yes"}',
    'CSL 2025:1506; NIS2 art. 3.1', 'active', 'fully_supported', 'high', 'legal_compliance', 50
  ),
  (
    'CSL_TLD_ANY_SIZE', 'Toppdomänsregister oavsett storlek',
    'Registreringsenheter för toppdomäner klassificeras som väsentliga oavsett storlek.',
    'classification', '{digital_infrastructure}',
    '{"all": [{"fact": "is_tld_registry", "op": "is_true"}]}',
    '{"decision": "classification", "value": "essential", "priority": 85, "likely_covered": "yes"}',
    'CSL 2025:1506; NIS2 art. 3.1', 'active', 'fully_supported', 'high', 'legal_compliance', 60
  ),
  (
    'CSL_TELECOM_MEDIUM_LARGE', 'Telekom — medelstor eller större',
    'Tillhandahållare av allmänna elektroniska kommunikationsnät/-tjänster som är medelstora eller större klassificeras som väsentliga.',
    'classification', null,
    '{"all": [
       {"fact": "is_telecom_provider", "op": "is_true"},
       {"fact": "size_class", "op": "in", "value": ["medium", "large"]}
     ]}',
    '{"decision": "classification", "value": "essential", "priority": 85, "likely_covered": "yes"}',
    'CSL 2025:1506; NIS2 art. 3.1', 'active', 'partially_supported', 'medium', 'legal_compliance', 70
  ),
  (
    'CSL_TELECOM_SMALL', 'Telekom — små och mikro',
    'Små tillhandahållare av allmänna elektroniska kommunikationsnät/-tjänster omfattas som viktiga oavsett storlekströskeln.',
    'classification', null,
    '{"all": [
       {"fact": "is_telecom_provider", "op": "is_true"},
       {"fact": "size_class", "op": "in", "value": ["micro", "small"]}
     ]}',
    '{"decision": "classification", "value": "important", "priority": 75, "likely_covered": "yes"}',
    'CSL 2025:1506; NIS2 art. 2.2', 'active', 'partially_supported', 'medium', 'legal_compliance', 80
  ),
  (
    'CSL_TRUST_SERVICE_REVIEW', 'Betrodda tjänster — manuell bedömning',
    'Tillhandahållare av betrodda tjänster omfattas oavsett storlek. Kvalificerade klassificeras som väsentliga, icke-kvalificerade som viktiga — kräver manuell bedömning.',
    'classification', null,
    '{"all": [{"fact": "is_trust_service_provider", "op": "is_true"}]}',
    '{"decision": "manual_review", "reason_sv": "Betrodda tjänster: kvalificerad status avgör väsentlig/viktig. Kräver manuell bedömning.", "priority": 88, "likely_covered": "yes"}',
    'CSL 2025:1506; eIDAS; NIS2 art. 3', 'active', 'requires_manual_review', 'medium', 'legal_compliance', 90
  ),
  (
    'CSL_SUPPLIER_REVIEW', 'Leverantör till kritiska verksamheter',
    'Verksamheten är leverantör till väsentliga/viktiga eller offentliga verksamheter. Kan omfattas indirekt via avtalskrav — manuell bedömning rekommenderas.',
    'flag', null,
    '{"all": [
       {"fact": "supplies_critical_entities", "op": "is_true"},
       {"fact": "size_class", "op": "in", "value": ["micro", "small"]}
     ]}',
    '{"decision": "flag", "reason_sv": "Leverantör till kritiska/offentliga verksamheter — kontrollera avtalskrav på incidentrapportering.", "priority": 10}',
    'CSL 2025:1506 leverantörskedjekrav', 'active', 'fully_supported', 'medium', null, 100
  )
) as v(rule_code, title_sv, description_sv, rule_type, sectors, condition, output, legal_reference, status, coverage_status, confidence, approver, sort_order)
on conflict (rule_set_id, rule_code) do nothing;

-- Manual-review flags: CER, DORA, security protection.
with flags as (
  select code, id from public.regulatory_rule_sets
  where code in ('CER_FLAG', 'DORA_FLAG', 'SECURITY_PROTECTION_FLAG')
)
insert into public.regulatory_rules (
  rule_set_id, rule_code, title_sv, description_sv, rule_type,
  condition, output, legal_reference, status, coverage_status, confidence, sort_order
)
select f.id, v.rule_code, v.title_sv, v.description_sv, 'flag',
       v.condition::jsonb, v.output::jsonb, v.legal_reference,
       'active', 'requires_manual_review', 'medium', 10
from flags f
join (values
  (
    'CER_FLAG', 'CER_RELEVANCE', 'CER-relevans — manuell bedömning',
    'Verksamheten kan omfattas av CER-direktivet (motståndskraft för kritiska entiteter). Kräver manuell bedömning.',
    '{"all": [{"fact": "is_cer_entity", "op": "is_true"}]}',
    '{"decision": "manual_review", "reason_sv": "CER-relevans indikerad. Manuell bedömning krävs.", "priority": 5}',
    'CER-direktivet (EU) 2022/2557'
  ),
  (
    'DORA_FLAG', 'DORA_RELEVANCE', 'DORA-relevans — manuell bedömning',
    'Finansiella entiteter kan omfattas av DORA i stället för/utöver NIS2. Kräver manuell bedömning.',
    '{"any": [
       {"fact": "sectors", "op": "contains", "value": "banking"},
       {"fact": "sectors", "op": "contains", "value": "financial_market_infrastructure"}
     ]}',
    '{"decision": "manual_review", "reason_sv": "DORA kan gälla för finansiella entiteter (lex specialis). Manuell bedömning krävs.", "priority": 5}',
    'DORA (EU) 2022/2554'
  ),
  (
    'SECURITY_PROTECTION_FLAG', 'SECURITY_PROTECTION', 'Säkerhetsskydd kan gälla',
    'Verksamheten kan hantera säkerhetsskyddsklassificerade uppgifter. Säkerhetsskyddslagen kan gälla parallellt.',
    '{"all": [{"fact": "handles_security_classified_info", "op": "is_true"}]}',
    '{"decision": "manual_review", "reason_sv": "Säkerhetsskydd kan gälla. Ladda inte upp säkerhetsskyddsklassificerade uppgifter om inte deployment och hanteringsprocess är godkända.", "priority": 5, "upload_warning": true}',
    'Säkerhetsskyddslagen (2018:585)'
  )
) as v(rule_set_code, rule_code, title_sv, description_sv, condition, output, legal_reference)
  on v.rule_set_code = f.code
on conflict (rule_set_id, rule_code) do nothing;
