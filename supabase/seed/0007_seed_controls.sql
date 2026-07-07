-- NIS2 readiness control library (spec §29). Controls under MCFFS 2026:11
-- enter into force 1 October 2026 and are marked pending until then.
-- No real PII.

insert into public.control_requirements (code, area, title_sv, description_sv, source_rule_set_code, legal_reference, evidence_required, default_owner_role, status, effective_from, sort_order)
values
  ('GOV-01', 'governance', 'Styrning och ledningsansvar', 'Ledningen har fastställt och följer upp styrande dokument för cybersäkerhetsarbetet.', 'CSL_2025_1506', 'CSL 2025:1506; MCFFS 2026:11', true, 'ciso', 'active', '2026-01-15', 10),
  ('GOV-02', 'management_training', 'Ledningens utbildning', 'Ledningen har genomgått utbildning i cybersäkerhet enligt MCFFS 2026:11.', 'MCFFS_2026_11', 'MCFFS 2026:11', true, 'management_approver', 'pending_guidance', '2026-10-01', 20),
  ('GOV-03', 'roles_responsibilities', 'Roller och ansvar', 'Roller och ansvar för informations- och cybersäkerhet är dokumenterade och tilldelade.', 'CSL_2025_1506', 'CSL 2025:1506', true, 'ciso', 'active', '2026-01-15', 30),
  ('RISK-01', 'risk_analysis', 'Riskanalys', 'Regelbunden riskanalys av nät- och informationssystem genomförs och dokumenteras.', 'MCFFS_2026_11', 'MCFFS 2026:11; NIS2 art. 21.2a', true, 'ciso', 'pending_guidance', '2026-10-01', 40),
  ('INFO-01', 'information_classification', 'Informationsklassificering', 'Information klassificeras utifrån konfidentialitet, riktighet och tillgänglighet.', 'MCFFS_2026_11', 'MCFFS 2026:11', true, 'information_owner', 'pending_guidance', '2026-10-01', 50),
  ('DOC-01', 'system_documentation', 'Systemdokumentation', 'Kritiska system och beroenden är dokumenterade med ägare, RTO/RPO och kontaktvägar.', 'MCFFS_2026_11', 'MCFFS 2026:11', true, 'system_owner', 'pending_guidance', '2026-10-01', 60),
  ('SUP-01', 'supplier_security', 'Leverantörssäkerhet', 'Säkerhetskrav och incidentrapporteringskrav är avtalade med kritiska leverantörer.', 'MCFFS_2026_11', 'MCFFS 2026:11; NIS2 art. 21.2d', true, 'vendor_manager', 'pending_guidance', '2026-10-01', 70),
  ('INC-01', 'incident_management', 'Incidenthanteringsprocess', 'Dokumenterad process för att upptäcka, hantera och rapportera incidenter, inklusive Cyberportalen-rutin.', 'MCFFS_2026_8', 'MCFFS 2026:8; NIS2 art. 21.2b', true, 'incident_manager', 'active', '2026-07-01', 80),
  ('INC-02', 'incident_management', 'Incidentroller och kontaktvägar', 'Incidentansvarig, CISO, juridik, DPO, kommunikation och ledningsgodkännare är utsedda med reserver.', 'MCFFS_2026_8', 'MCFFS 2026:8', true, 'tenant_admin', 'active', '2026-07-01', 90),
  ('CRIS-01', 'crisis_management', 'Krishantering', 'Krisorganisation och eskaleringsvägar är dokumenterade och övade.', 'MCFFS_2026_11', 'MCFFS 2026:11; NIS2 art. 21.2c', true, 'ciso', 'pending_guidance', '2026-10-01', 100),
  ('BC-01', 'business_continuity', 'Kontinuitetsplaner', 'Kontinuitetsplaner finns för kritiska tjänster med RTO/RPO och reservrutiner.', 'MCFFS_2026_11', 'MCFFS 2026:11; NIS2 art. 21.2c', true, 'system_owner', 'pending_guidance', '2026-10-01', 110),
  ('BC-02', 'backup', 'Säkerhetskopiering', 'Säkerhetskopiering av kritiska system enligt fastställd plan.', 'MCFFS_2026_11', 'MCFFS 2026:11', true, 'system_owner', 'pending_guidance', '2026-10-01', 120),
  ('BC-03', 'restore', 'Återläsningstester', 'Återläsning av säkerhetskopior testas regelbundet och dokumenteras.', 'MCFFS_2026_11', 'MCFFS 2026:11', true, 'system_owner', 'pending_guidance', '2026-10-01', 130),
  ('LOG-01', 'logging', 'Loggning', 'Säkerhetsloggning är aktiverad för kritiska system och skyddad mot manipulation.', 'MCFFS_2026_11', 'MCFFS 2026:11', true, 'system_owner', 'pending_guidance', '2026-10-01', 140),
  ('MON-01', 'monitoring', 'Övervakning och detektion', 'Kritiska system övervakas för att upptäcka incidenter och avvikelser.', 'MCFFS_2026_11', 'MCFFS 2026:11', true, 'ciso', 'pending_guidance', '2026-10-01', 150),
  ('IAM-01', 'mfa', 'Multifaktorautentisering', 'MFA används för administrativ åtkomst och distansåtkomst till kritiska system.', 'MCFFS_2026_11', 'MCFFS 2026:11; NIS2 art. 21.2j', true, 'system_owner', 'pending_guidance', '2026-10-01', 160),
  ('IAM-02', 'access_control', 'Behörighetsstyrning', 'Behörigheter tilldelas enligt behovsprincipen och granskas regelbundet.', 'MCFFS_2026_11', 'MCFFS 2026:11; NIS2 art. 21.2i', true, 'ciso', 'pending_guidance', '2026-10-01', 170),
  ('AST-01', 'asset_management', 'Tillgångshantering', 'IT- och OT-tillgångar är inventerade med ägare och livscykelstatus.', 'MCFFS_2026_11', 'MCFFS 2026:11; NIS2 art. 21.2i', true, 'system_owner', 'pending_guidance', '2026-10-01', 180),
  ('VUL-01', 'patching', 'Sårbarhets- och patchhantering', 'Sårbarheter identifieras, riskbedöms och åtgärdas inom fastställda tidsramar.', 'MCFFS_2026_11', 'MCFFS 2026:11; NIS2 art. 21.2e', true, 'system_owner', 'pending_guidance', '2026-10-01', 190),
  ('CHG-01', 'change_management', 'Ändringshantering', 'Ändringar i kritiska system riskbedöms, godkänns och dokumenteras.', 'MCFFS_2026_11', 'MCFFS 2026:11', true, 'system_owner', 'pending_guidance', '2026-10-01', 200),
  ('DEV-01', 'secure_development', 'Säker utveckling och anskaffning', 'Säkerhetskrav ställs vid utveckling och anskaffning av system.', 'MCFFS_2026_11', 'MCFFS 2026:11; NIS2 art. 21.2e', true, 'system_owner', 'pending_guidance', '2026-10-01', 210),
  ('CRY-01', 'cryptography', 'Kryptering', 'Policy och rutiner för kryptografi och kryptering där det är relevant.', 'MCFFS_2026_11', 'MCFFS 2026:11; NIS2 art. 21.2h', true, 'ciso', 'pending_guidance', '2026-10-01', 220),
  ('PHY-01', 'physical_security', 'Fysisk säkerhet', 'Fysiskt skydd av lokaler och utrustning som stödjer kritiska tjänster.', 'MCFFS_2026_11', 'MCFFS 2026:11', true, 'ciso', 'pending_guidance', '2026-10-01', 230),
  ('COM-01', 'communication_planning', 'Kommunikationsplanering', 'Plan för intern och extern kommunikation vid incidenter, inklusive mottagarinformation.', 'MCFFS_2026_8', 'MCFFS 2026:8 informationsskyldighet', true, 'communications_lead', 'active', '2026-07-01', 240),
  ('AUD-01', 'follow_up_audit', 'Uppföljning och säkerhetsrevision', 'Säkerhetsrevision och säkerhetsskanning enligt MCFFS 2026:12.', 'MCFFS_2026_12', 'MCFFS 2026:12', true, 'ciso', 'pending_guidance', '2026-10-01', 250)
on conflict (code) do nothing;

-- Data quality rules (spec §29).
insert into public.data_quality_rules (code, title_sv, description_sv, severity, link_path)
values
  ('critical_service_missing_owner', 'Kritisk tjänst saknar ägare', 'Alla kritiska tjänster ska ha en utsedd tjänsteägare.', 'critical', '/app/critical-services'),
  ('system_missing_vendor', 'System saknar leverantör', 'Externt driftade system ska ha en kopplad leverantör.', 'warning', '/app/systems'),
  ('incident_contact_missing', 'Incidentkontakt saknas', 'Organisationen saknar registrerad incidentkontakt.', 'critical', '/app/settings'),
  ('cyberportal_responsible_missing', 'Cyberportalen-ansvarig saknas', 'Ingen person är utsedd som ansvarig för rapportering i Cyberportalen.', 'critical', '/app/settings'),
  ('ciso_not_assigned', 'CISO ej utsedd', 'Rollen CISO/Säkerhetsansvarig är inte tilldelad.', 'critical', '/app/settings'),
  ('dpo_not_assigned', 'DPO ej utsedd', 'Personuppgifter finns men dataskyddsombud är inte utsett.', 'warning', '/app/settings'),
  ('rto_rpo_missing', 'RTO/RPO saknas', 'Kritiska system saknar RTO/RPO.', 'warning', '/app/systems?filter=missing-rto'),
  ('critical_system_missing_backup', 'Kritiskt system saknar backup', 'Sektorskritiska system saknar bekräftad säkerhetskopiering.', 'critical', '/app/systems'),
  ('vendor_missing_incident_contact', 'Leverantör saknar incidentkontakt', 'Leverantörer med kritiska tjänster saknar incidentkontakt.', 'warning', '/app/vendors'),
  ('report_missing_cyberportal_id', 'Cyberportalen-ID saknas', 'Inskickad rapport saknar Cyberportalens ärende-ID.', 'critical', '/app/reports'),
  ('approved_control_missing_evidence', 'Godkänd kontroll saknar bevis', 'Kontroller markerade som godkända saknar kopplat bevis.', 'warning', '/app/controls'),
  ('evidence_missing_classification', 'Bevis saknar klassificering', 'Bevis i bevisbanken saknar informationsklassificering.', 'warning', '/app/evidence')
on conflict (code) do nothing;
