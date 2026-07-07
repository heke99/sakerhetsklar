-- Lathund library (spec §28): 24 clickable step-by-step guides. No real PII.

insert into public.lathunds (code, title_sv, purpose_sv, applicable_rule_packages, outputs_sv, source_references, sort_order)
values
  ('OMFATTAS_VI', 'Omfattas vi av NIS2?', 'Avgör om organisationen sannolikt omfattas av cybersäkerhetslagen.', array['CSL_2025_1506'], 'Omfattningsbedömning med regelprofil', 'CSL 2025:1506', 10),
  ('VASENTLIG_VIKTIG', 'Är vi väsentlig eller viktig?', 'Klassificera verksamheten som väsentlig eller viktig verksamhetsutövare.', array['CSL_2025_1506'], 'Klassificeringsbeslut', 'CSL 2025:1506; NIS2 art. 3', 20),
  ('ANMALA_VERKSAMHET', 'Hur anmäler vi verksamheten?', 'Genomför registrering enligt MCFFS 2026:1 (aktiv från 2 februari 2026).', array['MCFFS_2026_1'], 'Registreringsunderlag och kvitto', 'MCFFS 2026:1', 30),
  ('FORSTA_2H', 'Första 2 timmarna vid incident', 'Strukturera de första åtgärderna vid en misstänkt incident.', array['MCFFS_2026_8'], 'Incident skapad med tidslinje och roller', 'MCFFS 2026:8', 40),
  ('AR_BETYDANDE', 'Är incidenten betydande?', 'Kör betydande-bedömningen och dokumentera beslutet.', array['MCFFS_2026_8', 'EU_2024_2690'], 'Betydande-bedömning med regelkällor', 'MCFFS 2026:8; EU 2024/2690', 50),
  ('UPPLYSNING_24H', '24h upplysning', 'Skapa och skicka tidig upplysning inom 24 timmar.', array['MCFFS_2026_8'], '24h-upplysning i Cyberportalen med ärende-ID', 'CSL 2025:1506; MCFFS 2026:8', 60),
  ('ANMALAN_72H', '72h incidentanmälan', 'Skapa och skicka incidentanmälan inom 72 timmar.', array['MCFFS_2026_8'], '72h-anmälan i Cyberportalen med ärende-ID', 'CSL 2025:1506; MCFFS 2026:8', 70),
  ('SLUTRAPPORT', 'Slutrapport', 'Skapa slutrapport senast en månad efter incidentanmälan.', array['MCFFS_2026_8'], 'Slutrapport med ledningsgodkännande', 'CSL 2025:1506; MCFFS 2026:8', 80),
  ('LAGESRAPPORT', 'Lägesrapport', 'Skapa lägesrapport när incidenten fortfarande pågår vid slutrapporttidpunkten.', array['MCFFS_2026_8'], 'Lägesrapport', 'MCFFS 2026:8', 90),
  ('SEN_RAPPORTERING', 'Sen rapportering', 'Hantera missad deadline: dokumentera, förklara och åtgärda.', array['MCFFS_2026_8'], 'Förklaringsutkast och åtgärdsplan', 'MCFFS 2026:8', 100),
  ('RESERVFORFARANDE', 'Reservförfarande', 'Rapportera när Cyberportalen är otillgänglig eller inloggning inte fungerar.', array['MCFFS_2026_8'], 'Reservrapport med spårningsnummer', 'MCFFS 2026:8', 110),
  ('GDPR_INCIDENT', 'GDPR-personuppgiftsincident', 'Bedöm och anmäl personuppgiftsincident till IMY (normalt inom 72 timmar).', array['GDPR_PERSONAL_DATA_BREACH'], 'GDPR-bedömning och IMY-anmälan', 'GDPR art. 33–34', 120),
  ('LEVERANTORSINCIDENT', 'Leverantörsincident', 'Hantera incident som har sitt ursprung hos leverantör.', array['MCFFS_2026_8', 'CONTRACTUAL_REPORTING'], 'Leverantörskontakt och rapporteringsspår', 'MCFFS 2026:8', 130),
  ('RANSOMWARE', 'Ransomware', 'Hantera ransomware-angrepp: isolera, bedöm, rapportera.', array['MCFFS_2026_8', 'GDPR_PERSONAL_DATA_BREACH'], 'Incident, bedömning och rapporter', 'MCFFS 2026:8', 140),
  ('DATALACKA', 'Dataläcka', 'Hantera misstänkt eller bekräftad dataläcka.', array['MCFFS_2026_8', 'GDPR_PERSONAL_DATA_BREACH'], 'Incident, GDPR-spår och rapporter', 'MCFFS 2026:8; GDPR', 150),
  ('OT_SCADA', 'OT/SCADA-incident', 'Hantera incident i drift-/processnära system.', array['MCFFS_2026_8'], 'Incident med OT-påverkan och bedömning', 'MCFFS 2026:8', 160),
  ('INFORMERA_MOTTAGARE', 'Informationsskyldighet till kunder/mottagare', 'Besluta om och genomför information till berörda mottagare.', array['MCFFS_2026_8'], 'Dokumenterat mottagarbeslut och meddelande', 'MCFFS 2026:8 informationsskyldighet', 170),
  ('SAKERHETSSKYDD', 'Säkerhetsskydd-varning', 'Kontrollera om säkerhetsskyddslagen berörs innan information hanteras i systemet.', array['SECURITY_PROTECTION_FLAG'], 'Dokumenterad säkerhetsskyddskontroll', 'Säkerhetsskyddslagen (2018:585)', 180),
  ('CYBERFORSAKRING', 'Cyberförsäkring', 'Notifiera försäkringsgivaren och säkra bevis för skadereglering.', array['CYBER_INSURANCE'], 'Försäkringsnotifiering registrerad', 'Försäkringsvillkor', 190),
  ('STYRELSERAPPORT', 'Styrelserapport', 'Ta fram styrelserapport om cybersäkerhetsläget.', array['CSL_2025_1506'], 'Styrelserapport (PDF/Word)', 'CSL 2025:1506; MCFFS 2026:11', 200),
  ('TABLETOP', 'Tabletop exercise', 'Planera och genomför en tabletop-övning.', array['MCFFS_2026_11'], 'Övningsrapport med fynd och åtgärdsplan', 'MCFFS 2026:11', 210),
  ('TILLSYN', 'Tillsynsförberedelse', 'Förbered organisationen för tillsyn från tillsynsmyndigheten.', array['CSL_2025_1506', 'MCFFS_2026_12'], 'Tillsynspaket exporterat', 'CSL 2025:1506; MCFFS 2026:12', 220),
  ('PTS_MANUELL', 'PTS/digital-infrastruktur manuell bedömning', 'Manuell bedömning för PTS-sektorer där regler är utkast/ej slutliga.', array['PTS_RULE_TRACK', 'EU_2024_2690'], 'Dokumenterad manuell bedömning', 'PTS föreskrifter (utkast); EU 2024/2690', 230),
  ('EIDAS_PARALLELL', 'eIDAS/trust service parallellrapportering', 'Hantera parallella rapporteringsspår för betrodda tjänster.', array['EIDAS_TRUST_SERVICE'], 'Parallella rapporter dokumenterade', 'eIDAS art. 19', 240)
on conflict (code) do nothing;

-- Steps per lathund (3–6 operational steps each, linked into the app).
with steps (lathund_code, step_number, title_sv, description_sv, link_path) as (
  values
    ('OMFATTAS_VI', 1, 'Samla organisationsdata', 'Organisationsnummer, organisationstyp, antal anställda, omsättning och balansomslutning.', '/app/onboarding'),
    ('OMFATTAS_VI', 2, 'Gör storleksbedömningen', 'Kör SME-storleksmotorn i onboarding steg 3.', '/app/onboarding'),
    ('OMFATTAS_VI', 3, 'Välj sektorer och särskilda kategorier', 'Ange NIS2-sektorer, undersektorer och digitala kategorier.', '/app/onboarding'),
    ('OMFATTAS_VI', 4, 'Granska regelprofilen', 'Kontrollera resultatet, tillsynsmyndighet och regelpaket. Vid manuell bedömning: boka juridisk genomgång.', '/app/scope'),

    ('VASENTLIG_VIKTIG', 1, 'Kontrollera sektorns bilaga', 'Bilaga 1 (högkritisk) eller bilaga 2 (annan kritisk).', '/app/scope'),
    ('VASENTLIG_VIKTIG', 2, 'Kontrollera storleksklassen', 'Stor i bilaga 1 → väsentlig. Medelstor → viktig. Särskilda regler för DNS/TLD/telekom/betrodda tjänster.', '/app/scope'),
    ('VASENTLIG_VIKTIG', 3, 'Dokumentera klassificeringen', 'Låt juridik/compliance godkänna klassificeringsbeslutet.', '/app/scope'),

    ('ANMALA_VERKSAMHET', 1, 'Kontrollera registreringsplikt', 'Registrering enligt MCFFS 2026:1 är aktiv från 2 februari 2026.', '/app/scope'),
    ('ANMALA_VERKSAMHET', 2, 'Samla registreringsuppgifter', 'Organisationsuppgifter, sektorer, kontaktuppgifter och IP-serier där relevant.', '/app/settings'),
    ('ANMALA_VERKSAMHET', 3, 'Skicka in anmälan', 'Skicka anmälan till MSB och notera inskickat datum.', null),
    ('ANMALA_VERKSAMHET', 4, 'Ladda upp kvittens', 'Spara bekräftelsen i bevisbanken.', '/app/evidence'),
    ('ANMALA_VERKSAMHET', 5, 'Bevaka ändringar', 'Ändringar ska anmälas inom 14 dagar där det är relevant.', '/app/scope'),

    ('FORSTA_2H', 1, 'Skapa incidenten', 'Registrera vad som hänt, när det upptäcktes och hur.', '/app/incidents'),
    ('FORSTA_2H', 2, 'Koppla påverkade system och tjänster', 'Markera sektorskritiska system och kritiska tjänster.', '/app/incidents'),
    ('FORSTA_2H', 3, 'Aktivera incidentroller', 'Incidentansvarig leder, CISO informeras, juridik vid behov.', '/app/settings'),
    ('FORSTA_2H', 4, 'Säkra bevis tidigt', 'Loggar, skärmbilder och tidslinjer till bevisbanken.', '/app/evidence'),
    ('FORSTA_2H', 5, 'Kör en första betydande-bedömning', 'Även med ofullständiga uppgifter — systemet visar vad som saknas.', null),

    ('AR_BETYDANDE', 1, 'Fyll i påverkansuppgifter', 'Avbrottstid, reservrutiner, berörda användare, skyddad information.', null),
    ('AR_BETYDANDE', 2, 'Kör regelmotorn', 'Bedömningen matchar era regelpaket och sektorströsklar.', null),
    ('AR_BETYDANDE', 3, 'CISO granskar', 'CISO kontrollerar underlag och rekommendation.', null),
    ('AR_BETYDANDE', 4, 'Juridik godkänner', 'Godkänn eller avvisa rapporteringsbeslutet. Beslutet loggas.', null),

    ('UPPLYSNING_24H', 1, 'Skapa utkastet', 'Skapa 24h-upplysning från incidentens rapportsida.', null),
    ('UPPLYSNING_24H', 2, 'Fyll i och granska fälten', 'Alla obligatoriska fält enligt MCFFS 2026:8.', null),
    ('UPPLYSNING_24H', 3, 'Godkänn rapporten', 'Juridik/ledning godkänner före inskick.', null),
    ('UPPLYSNING_24H', 4, 'Kopiera till Cyberportalen', 'Använd kopieringsläget fält för fält och skicka i Cyberportalen.', null),
    ('UPPLYSNING_24H', 5, 'Spara ärende-ID och kvitto', 'Utan ID kan steget inte stängas.', null),

    ('ANMALAN_72H', 1, 'Skapa utkastet', 'Skapa 72h-anmälan; uppgifter från upplysningen återanvänds.', null),
    ('ANMALAN_72H', 2, 'Uppdatera med ny kunskap', 'Orsaksbedömning, systempåverkan, IoC, vidtagna åtgärder.', null),
    ('ANMALAN_72H', 3, 'Godkänn och skicka', 'Godkänn, kopiera till Cyberportalen och markera som inskickad.', null),
    ('ANMALAN_72H', 4, 'Spara ärende-ID och kvitto', 'Nytt ID kan utfärdas per rapportsteg.', null),

    ('SLUTRAPPORT', 1, 'Sammanställ konsekvenser', 'Slutlig konsekvensbedömning, berörda mottagare, geografi och ekonomi.', null),
    ('SLUTRAPPORT', 2, 'Dokumentera grundorsak och åtgärder', 'Tekniska och organisatoriska åtgärder samt återfallsskydd.', null),
    ('SLUTRAPPORT', 3, 'Hämta ledningens godkännande', 'Slutrapporten kräver ledningsgodkännande.', null),
    ('SLUTRAPPORT', 4, 'Skicka och arkivera', 'Skicka inom en månad efter incidentanmälan. Spara ID och kvitto.', null),

    ('LAGESRAPPORT', 1, 'Konstatera att incidenten pågår', 'Vid slutrapportfristen: skapa lägesrapport i stället.', null),
    ('LAGESRAPPORT', 2, 'Beskriv läget', 'Varför incidenten pågår, uppskattad varaktighet, fortsatt påverkan.', null),
    ('LAGESRAPPORT', 3, 'Planera nästa uppdatering', 'Ange plan för nästa rapport och skicka.', null),

    ('SEN_RAPPORTERING', 1, 'Öppna ärendet för sen rapportering', 'Systemet skapar ärendet automatiskt när en deadline missas.', null),
    ('SEN_RAPPORTERING', 2, 'Besvara utredningsfrågorna', 'Varför sen, vem visste vad, varför identifierades inte betydelsen.', null),
    ('SEN_RAPPORTERING', 3, 'Generera förklaringsutkast', 'Internt utkast och tillsynsutkast skapas från svaren.', null),
    ('SEN_RAPPORTERING', 4, 'Ledningen godkänner', 'Godkänn förklaringen och följ upp åtgärdsplanen.', null),
    ('SEN_RAPPORTERING', 5, 'Skicka rapporten ändå', 'Skicka den försenade rapporten snarast — dröjsmål förvärrar.', null),

    ('RESERVFORFARANDE', 1, 'Dokumentera orsaken', 'Varför Cyberportalen inte kan användas (driftstörning, inloggning).', null),
    ('RESERVFORFARANDE', 2, 'Klassificera informationen', 'Säkerhetsskyddsklassificerade uppgifter får inte skickas utan godkänd hantering.', null),
    ('RESERVFORFARANDE', 3, 'Generera reservrapport', 'Exportera rapporten som PDF/Word.', null),
    ('RESERVFORFARANDE', 4, 'Välj inlämningsväg', 'Säker länk, rekommenderat brev eller annan godkänd metod. Notera spårningsnummer.', null),
    ('RESERVFORFARANDE', 5, 'Kom ihåg: fristerna gäller ändå', 'Reservförfarandet påverkar inte tidsfristerna.', null),

    ('GDPR_INCIDENT', 1, 'Avgör om personuppgifter berörs', 'Om ja: starta GDPR-spåret på incidenten.', null),
    ('GDPR_INCIDENT', 2, 'Bedöm risken', 'Kategorier, antal registrerade, konsekvenser, hög risk?', null),
    ('GDPR_INCIDENT', 3, 'Besluta om IMY-anmälan', '72-timmarsfristen räknas från kännedom. Icke-anmälan kräver motivering.', null),
    ('GDPR_INCIDENT', 4, 'DPO godkänner', 'Dataskyddsombudet godkänner bedömning och beslut.', null),
    ('GDPR_INCIDENT', 5, 'Informera registrerade vid hög risk', 'Utkast till kommunikation, godkänns före utskick.', null),

    ('LEVERANTORSINCIDENT', 1, 'Kontakta leverantörens incidentjour', 'Använd incidentkontakten i leverantörsregistret.', '/app/vendors'),
    ('LEVERANTORSINCIDENT', 2, 'Skapa incident med leverantörskoppling', 'Markera leverantörsursprung.', '/app/incidents'),
    ('LEVERANTORSINCIDENT', 3, 'Begär skriftligt underlag', 'Leverantörsutlåtande till bevisbanken.', '/app/evidence'),
    ('LEVERANTORSINCIDENT', 4, 'Bedöm egen rapporteringsplikt', 'Er rapporteringsplikt gäller även när leverantören orsakat incidenten.', null),
    ('LEVERANTORSINCIDENT', 5, 'Kontrollera avtalsvillkor', 'SLA, viten och rapporteringskrav i leverantörsavtalet.', '/app/vendors'),

    ('RANSOMWARE', 1, 'Isolera drabbade system', 'Koppla bort men stäng inte av — bevara flyktiga bevis.', null),
    ('RANSOMWARE', 2, 'Aktivera war room', 'Samla beslutsfattare, logga alla beslut.', null),
    ('RANSOMWARE', 3, 'Skapa incident och kör bedömning', 'Ransomware innebär ofta misstänkt brottslig handling.', '/app/incidents'),
    ('RANSOMWARE', 4, 'Starta GDPR-spåret', 'Kryptering/exfiltration av personuppgifter är en personuppgiftsincident.', null),
    ('RANSOMWARE', 5, 'Polisanmäl och rapportera', '24h-upplysning, polisanmälan och försäkringsnotifiering.', null),
    ('RANSOMWARE', 6, 'Planera återställning', 'Rena säkerhetskopior, ordning för återläsning, forensik före radering.', null),

    ('DATALACKA', 1, 'Bekräfta läckan', 'Verifiera omfattning: vilka data, vilka system, vilken period.', null),
    ('DATALACKA', 2, 'Stoppa åtkomsten', 'Stäng exponeringen, rotera nycklar/lösenord.', null),
    ('DATALACKA', 3, 'Kör betydande-bedömning', 'Skyddad information för annan part eller minst 500 personer → betydande.', null),
    ('DATALACKA', 4, 'Starta GDPR-spåret', 'Bedöm IMY-anmälan och information till registrerade.', null),
    ('DATALACKA', 5, 'Kommunicera kontrollerat', 'Mottagarbeslut med motivering och godkännare.', null),

    ('OT_SCADA', 1, 'Prioritera säkerhet och drift', 'Människors säkerhet först; håll processen stabil.', null),
    ('OT_SCADA', 2, 'Segmentera IT från OT', 'Begränsa spridning mellan miljöerna.', null),
    ('OT_SCADA', 3, 'Skapa incident med OT-koppling', 'Koppla sektorskritiska system; styrning/övervakning-trösklar kan gälla.', '/app/incidents'),
    ('OT_SCADA', 4, 'Kör sektorsbedömningen', 'Energi/vatten har särskilda trösklar för styrning och övervakning.', null),
    ('OT_SCADA', 5, 'Aktivera reservdrift', 'Manuell drift enligt kontinuitetsplanen. Klockan för reservrutiner räknas.', null),

    ('INFORMERA_MOTTAGARE', 1, 'Identifiera påverkade tjänster', 'Vilka externa tjänster och vilka mottagare berörs.', null),
    ('INFORMERA_MOTTAGARE', 2, 'Bedöm om information kan skada hanteringen', 'Informera nu, vänta (motivering) eller informera inte (motivering).', null),
    ('INFORMERA_MOTTAGARE', 3, 'Skriv meddelandet', 'Vad hänt, vad mottagaren ska göra, vad som händer annars.', null),
    ('INFORMERA_MOTTAGARE', 4, 'Godkänn och skicka', 'Kommunikationsansvarig + godkännare. Beslutet loggas.', null),

    ('SAKERHETSSKYDD', 1, 'Ställ kontrollfrågan', 'Rör incidenten säkerhetskänslig verksamhet eller säkerhetsskyddsklassificerade uppgifter?', null),
    ('SAKERHETSSKYDD', 2, 'Stoppa uppladdning', 'Sådana uppgifter får inte läggas in om deployment inte är godkänd för det.', null),
    ('SAKERHETSSKYDD', 3, 'Kontakta säkerhetsskyddschef', 'Säkerhetsskyddslagen har egna processer och kontaktvägar.', null),
    ('SAKERHETSSKYDD', 4, 'Dokumentera utanför systemet vid behov', 'Referera till extern hantering utan att lägga in innehållet.', null),

    ('CYBERFORSAKRING', 1, 'Kontrollera policyn', 'Notifieringsfrist, kontakt och kravlista i försäkringsregistret.', null),
    ('CYBERFORSAKRING', 2, 'Notifiera försäkringsgivaren', 'Inom fristen — annars riskeras ersättningen.', null),
    ('CYBERFORSAKRING', 3, 'Säkra kravd bevisning', 'Forensik, kostnadsunderlag och tidslinje till bevisbanken.', '/app/evidence'),
    ('CYBERFORSAKRING', 4, 'Registrera notifieringen', 'Tidpunkt och referens loggas på incidenten.', null),

    ('STYRELSERAPPORT', 1, 'Hämta ledningsvyn', 'Readiness, risker, incidenter och deadlines.', '/app/management'),
    ('STYRELSERAPPORT', 2, 'Komplettera med beslutspunkter', 'Vilka beslut behöver styrelsen fatta?', null),
    ('STYRELSERAPPORT', 3, 'Exportera styrelserapporten', 'PDF/Word med sammanfattning, riskkarta och åtgärder.', '/app/management'),

    ('TABLETOP', 1, 'Välj scenario', 'Ransomware, leverantörsincident, dataläcka, OT med flera.', '/app/exercises'),
    ('TABLETOP', 2, 'Planera övningen', 'Deltagare, roller, injects och tidsram.', '/app/exercises'),
    ('TABLETOP', 3, 'Genomför och mät', 'Tid till klassificering och rapportutkast; missade steg.', '/app/exercises'),
    ('TABLETOP', 4, 'Dokumentera fynd', 'Fynd, poäng och åtgärdsplan.', '/app/exercises'),

    ('TILLSYN', 1, 'Kontrollera readiness-poängen', 'NIS2-, rapporterings- och tillsynsberedskap.', '/app/controls'),
    ('TILLSYN', 2, 'Komplettera bevis', 'Alla godkända kontroller ska ha bevis.', '/app/evidence'),
    ('TILLSYN', 3, 'Generera tillsynspaketet', 'Omfattning, kontroller, incidenter, rapporter, beslut och utbildningar.', '/app/export-exit'),
    ('TILLSYN', 4, 'Genomför intern granskning', 'Gå igenom paketet som om ni var tillsynsmyndigheten.', null),

    ('PTS_MANUELL', 1, 'Kontrollera regeltäckningen', 'PTS-paketet är utkast/delvis — systemet visar vilka delar.', '/app/rules'),
    ('PTS_MANUELL', 2, 'Tillämpa EU 2024/2690 där det gäller', 'Moln, MSP/MSSP, DNS m.fl. har EU-regler som gäller direkt.', null),
    ('PTS_MANUELL', 3, 'Gör manuell bedömning', 'Dokumentera bedömningen mot tillgängliga källor med juridikstöd.', null),
    ('PTS_MANUELL', 4, 'Bevaka slutliga föreskrifter', 'Regelpaketet uppdateras när PTS publicerar slutliga regler.', '/app/rules'),

    ('EIDAS_PARALLELL', 1, 'Identifiera spåren', 'NIS2/Cyberportalen och eIDAS/PTS är separata spår med egna frister.', null),
    ('EIDAS_PARALLELL', 2, 'Skapa båda rapporterna', 'Rapporterna slås inte ihop om det inte uttryckligen konfigurerats.', null),
    ('EIDAS_PARALLELL', 3, 'Håll isär tidsfristerna', 'eIDAS kan kräva 24h-anmälan.', null),
    ('EIDAS_PARALLELL', 4, 'Dokumentera båda inskicken', 'Referenser och kvitton per spår.', null)
)
insert into public.lathund_steps (lathund_id, step_number, title_sv, description_sv, link_path)
select l.id, s.step_number, s.title_sv, s.description_sv, s.link_path
from steps s
join public.lathunds l on l.code = s.lathund_code
on conflict (lathund_id, step_number) do nothing;

-- Exercise scenarios (spec §34).
insert into public.exercise_scenarios (code, title_sv, description_sv, scenario_type)
values
  ('RANSOMWARE', 'Ransomware-angrepp', 'Krypterande angrepp mot centrala servrar med utpressningskrav.', 'ransomware'),
  ('SUPPLIER_INCIDENT', 'Leverantörsincident', 'Kritisk driftleverantör drabbad; era tjänster påverkas indirekt.', 'supplier'),
  ('DATA_LEAK', 'Dataläcka', 'Skyddad information exponerad publikt via felkonfigurerad lagring.', 'data_leak'),
  ('OT_SCADA', 'OT/SCADA-incident', 'Styrsystem för process/produktion beter sig oförutsägbart.', 'ot'),
  ('CLOUD_OUTAGE', 'Molnavbrott', 'Er molnleverantör har totalt avbrott i er region.', 'cloud_outage'),
  ('CRITICAL_SERVICE_OUTAGE', 'Avbrott i kritisk tjänst', 'Er externa kritiska tjänst är nere; mottagare påverkas direkt.', 'service_outage'),
  ('PERSONAL_DATA_BREACH', 'Personuppgiftsincident', 'Personuppgifter för ett stort antal registrerade har röjts.', 'gdpr'),
  ('PTS_DIGITAL_INCIDENT', 'PTS/digital leverantörsincident', 'Incident i digital tjänst som omfattas av EU 2024/2690.', 'pts_digital'),
  ('LATE_REPORTING', 'Sen rapportering', 'Incidenten identifierades som betydande för sent — öva sen-rapporteringsflödet.', 'late_reporting')
on conflict (code) do nothing;
