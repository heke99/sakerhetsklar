-- Sectors detail, subsectors, entity types, supervisory authorities and
-- mappings (spec §12–13). Onboarding steps. No real PII.

insert into public.supervisory_authorities (code, name_sv, name_en, website, is_regional)
values
  ('energimyndigheten', 'Energimyndigheten', 'Swedish Energy Agency', 'https://www.energimyndigheten.se', false),
  ('transportstyrelsen', 'Transportstyrelsen', 'Swedish Transport Agency', 'https://www.transportstyrelsen.se', false),
  ('finansinspektionen', 'Finansinspektionen', 'Swedish Financial Supervisory Authority', 'https://www.fi.se', false),
  ('ivo', 'Inspektionen för vård och omsorg (IVO)', 'Health and Social Care Inspectorate', 'https://www.ivo.se', false),
  ('lakemedelsverket', 'Läkemedelsverket', 'Medical Products Agency', 'https://www.lakemedelsverket.se', false),
  ('livsmedelsverket', 'Livsmedelsverket', 'National Food Agency', 'https://www.livsmedelsverket.se', false),
  ('pts', 'Post- och telestyrelsen (PTS)', 'Swedish Post and Telecom Authority', 'https://www.pts.se', false),
  ('lansstyrelserna', 'Utsedda länsstyrelser', 'Designated County Administrative Boards', 'https://www.lansstyrelsen.se', true),
  ('msb', 'Myndigheten för samhällsskydd och beredskap (MSB)', 'Swedish Civil Contingencies Agency', 'https://www.msb.se', false),
  ('imy', 'Integritetsskyddsmyndigheten (IMY)', 'Swedish Authority for Privacy Protection', 'https://www.imy.se', false)
on conflict (code) do nothing;

insert into public.subsectors (sector_code, code, name_sv, name_en)
values
  ('energy', 'electricity', 'El', 'Electricity'),
  ('energy', 'district_heating_cooling', 'Fjärrvärme och fjärrkyla', 'District heating and cooling'),
  ('energy', 'oil', 'Olja', 'Oil'),
  ('energy', 'gas', 'Gas', 'Gas'),
  ('energy', 'hydrogen', 'Vätgas', 'Hydrogen'),
  ('transport', 'air', 'Lufttransport', 'Air transport'),
  ('transport', 'rail', 'Järnvägstransport', 'Rail transport'),
  ('transport', 'water', 'Sjöfart', 'Water transport'),
  ('transport', 'road', 'Vägtransport', 'Road transport'),
  ('transport', 'public_transport', 'Kollektivtrafik', 'Public transport'),
  ('healthcare', 'healthcare_providers', 'Vårdgivare', 'Healthcare providers'),
  ('healthcare', 'medical_products', 'Läkemedel och medicintekniska produkter', 'Medical products'),
  ('digital_infrastructure', 'dns', 'DNS-tjänsteleverantörer', 'DNS service providers'),
  ('digital_infrastructure', 'tld', 'Registreringsenheter för toppdomäner', 'TLD name registries'),
  ('digital_infrastructure', 'ixp', 'Internetknutpunkter (IXP)', 'Internet exchange points'),
  ('digital_infrastructure', 'cloud', 'Molntjänstleverantörer', 'Cloud computing service providers'),
  ('digital_infrastructure', 'datacenter', 'Datacentraltjänster', 'Data centre service providers'),
  ('digital_infrastructure', 'cdn', 'Leverantörer av nätverk för innehållsleverans (CDN)', 'Content delivery network providers'),
  ('digital_infrastructure', 'trust_services', 'Tillhandahållare av betrodda tjänster', 'Trust service providers'),
  ('digital_infrastructure', 'telecom', 'Allmänna elektroniska kommunikationsnät och -tjänster', 'Public electronic communications networks and services'),
  ('digital_infrastructure', 'domain_registration', 'Domännamnsregistreringstjänster', 'Domain name registration services'),
  ('ict_b2b', 'msp', 'Leverantörer av hanterade tjänster (MSP)', 'Managed service providers'),
  ('ict_b2b', 'mssp', 'Leverantörer av hanterade säkerhetstjänster (MSSP)', 'Managed security service providers'),
  ('digital_providers', 'online_marketplace', 'Onlinemarknadsplatser', 'Online marketplaces'),
  ('digital_providers', 'search_engine', 'Sökmotorer', 'Online search engines'),
  ('digital_providers', 'social_network', 'Plattformar för sociala nätverkstjänster', 'Social networking service platforms'),
  ('public_administration', 'state_agency', 'Statliga myndigheter', 'State agencies'),
  ('public_administration', 'municipality', 'Kommuner', 'Municipalities'),
  ('public_administration', 'region', 'Regioner', 'Regions')
on conflict (code) do nothing;

insert into public.entity_types (code, name_sv, name_en, is_public_body)
values
  ('private_company', 'Privat företag', 'Private company', false),
  ('municipality', 'Kommun', 'Municipality', true),
  ('region', 'Region', 'Region', true),
  ('municipal_company', 'Kommunalt bolag', 'Municipal company', true),
  ('state_agency', 'Statlig myndighet', 'State agency', true),
  ('other_public_body', 'Annat offentligt organ', 'Other public body', true),
  ('non_profit', 'Ideell organisation', 'Non-profit', false),
  ('other', 'Övrigt', 'Other', false)
on conflict (code) do nothing;

insert into public.sector_annex_mappings (sector_code, annex, source_reference)
select code, annex, 'CSL 2025:1506 bilagor'
from public.sectors
on conflict (sector_code, annex) do nothing;

-- Authority mapping (spec §13).
insert into public.sector_supervisory_authorities (sector_code, subsector_code, authority_code, condition_note_sv, source_reference)
values
  ('energy', null, 'energimyndigheten', null, 'CSF 2025:1507'),
  ('transport', null, 'transportstyrelsen', null, 'CSF 2025:1507'),
  ('banking', null, 'finansinspektionen', null, 'CSF 2025:1507'),
  ('financial_market_infrastructure', null, 'finansinspektionen', null, 'CSF 2025:1507'),
  ('healthcare', 'healthcare_providers', 'ivo', 'Vårdgivare', 'CSF 2025:1507'),
  ('healthcare', 'medical_products', 'lakemedelsverket', 'Övriga hälso-/läkemedelsaktörer', 'CSF 2025:1507'),
  ('drinking_water', null, 'livsmedelsverket', null, 'CSF 2025:1507'),
  ('waste_water', null, 'livsmedelsverket', null, 'CSF 2025:1507'),
  ('food', null, 'livsmedelsverket', null, 'CSF 2025:1507'),
  ('digital_infrastructure', null, 'pts', null, 'CSF 2025:1507'),
  ('digital_providers', null, 'pts', null, 'CSF 2025:1507'),
  ('ict_b2b', null, 'pts', null, 'CSF 2025:1507'),
  ('postal_courier', null, 'pts', null, 'CSF 2025:1507'),
  ('space', null, 'pts', null, 'CSF 2025:1507'),
  ('waste_management', null, 'lansstyrelserna', null, 'CSF 2025:1507'),
  ('research', null, 'lansstyrelserna', null, 'CSF 2025:1507'),
  ('public_administration', null, 'lansstyrelserna', 'Utom länsstyrelserna själva', 'CSF 2025:1507'),
  ('chemicals', null, 'lansstyrelserna', null, 'CSF 2025:1507'),
  ('manufacturing', null, 'lansstyrelserna', 'Vissa tillverkningskategorier', 'CSF 2025:1507')
on conflict (sector_code, subsector_code, authority_code) do nothing;

-- Onboarding steps (spec §11).
insert into public.onboarding_steps (step_key, title_sv, description_sv, sort_order, required)
values
  ('organization', 'Skapa organisation', 'Organisationsuppgifter, kontaktperson och organisationstyp.', 1, true),
  ('legal_entities', 'Juridiska enheter och koncernstruktur', 'Juridiska enheter, koncern, dotterbolag och ägarförhållanden.', 2, true),
  ('size_assessment', 'Storleksbedömning', 'Anställda, omsättning och balansomslutning — SME-klassificering.', 3, true),
  ('sector_assessment', 'Sektor- och verksamhetsbedömning', 'Vilka NIS2-sektorer, undersektorer och tjänster som gäller.', 4, true),
  ('rule_profile', 'Regelprofil', 'Sannolik omfattning, klassificering, tillsynsmyndighet och regelpaket.', 5, true),
  ('registration', 'Registreringsstöd', 'Checklista och underlag för anmälan enligt MCFFS 2026:1.', 6, true),
  ('systems', 'Kritiska system och tjänster', 'System, kritiska tjänster, RTO/RPO och ägare.', 7, true),
  ('vendors', 'Leverantörer', 'Leverantörer, avtal, incidentkontakter och underleverantörer.', 8, true),
  ('incident_roles', 'Incidentroller', 'Incidentansvarig, CISO, juridik, DPO, kommunikation och ledningsgodkännare.', 9, true),
  ('complete', 'Klart — översikt', 'Readiness-procent, saknade uppgifter och rekommenderade nästa steg.', 10, true)
on conflict (step_key) do nothing;
