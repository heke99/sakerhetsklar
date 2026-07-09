-- Seed 0013: official source URLs and verification metadata.
--
-- Verified against official sources on 2026-07-09:
--   * Cybersäkerhetslag (2025:1506) — riksdagen.se, utfärdad 2025-12-11,
--     i kraft 2026-01-15 (upphäver 2018:1174).
--   * Cybersäkerhetsförordning (2025:1507) — riksdagen.se, utfärdad
--     2025-12-11, i kraft 2026-01-15, ändrad t.o.m. SFS 2026:623.
--   * MCFFS 2026:8 (incidentrapportering och informationsskyldighet) —
--     mcf.se, gällande från 2026-07-01. OBS: utfärdare är Myndigheten för
--     civilt försvar (MCF), inte MSB. Incidentrapporter tas emot av
--     NCSC/CERT-SE via cyberportalen och vidarebefordras till
--     tillsynsmyndigheter.
--   * Genomförandeförordning (EU) 2024/2690 — EUR-Lex, i kraft 2024-11-07.
--   * NIS2-direktivet (EU) 2022/2555 — EUR-Lex.
--   * GDPR (EU) 2016/679 — EUR-Lex; IMY-anmälan normalt inom 72 timmar.
--   * eIDAS (EU) 910/2014 — EUR-Lex; PTS är tillsynsmyndighet i Sverige.

-- Official URLs on legal sources.
update public.legal_sources set
  url = 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/cybersakerhetslag-20251506_sfs-2025-1506/',
  last_verified_at = '2026-07-09T00:00:00Z',
  verified_by = 'seed:0013 (riksdagen.se)'
where code = 'CSL_2025_1506';

update public.legal_sources set
  url = 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/cybersakerhetsforordning-20251507_sfs-2025-1507/',
  last_verified_at = '2026-07-09T00:00:00Z',
  verified_by = 'seed:0013 (riksdagen.se)'
where code = 'CSF_2025_1507';

update public.legal_sources set
  url = 'https://www.mcf.se/sv/regler/gallande-regler/mcffs-20268/',
  publisher = 'Myndigheten för civilt försvar (MCF)',
  last_verified_at = '2026-07-09T00:00:00Z',
  verified_by = 'seed:0013 (mcf.se)'
where code = 'MCFFS_2026_8';

-- MCFFS series is issued by Myndigheten för civilt försvar (MCF).
update public.legal_sources set
  publisher = 'Myndigheten för civilt försvar (MCF)',
  last_verified_at = '2026-07-09T00:00:00Z',
  verified_by = 'seed:0013 (mcf.se)'
where code in ('MCFFS_2026_1', 'MCFFS_2026_7', 'MCFFS_2026_11', 'MCFFS_2026_12');

update public.legal_sources set
  url = 'https://eur-lex.europa.eu/eli/reg_impl/2024/2690/oj',
  last_verified_at = '2026-07-09T00:00:00Z',
  verified_by = 'seed:0013 (eur-lex)'
where code = 'EU_2024_2690';

update public.legal_sources set
  url = 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
  last_verified_at = '2026-07-09T00:00:00Z',
  verified_by = 'seed:0013 (eur-lex)'
where code = 'GDPR';

update public.legal_sources set
  url = 'https://eur-lex.europa.eu/eli/reg/2014/910/oj',
  last_verified_at = '2026-07-09T00:00:00Z',
  verified_by = 'seed:0013 (eur-lex)'
where code = 'EIDAS';

-- Verification stamps on rule sets (aligned with their sources).
update public.regulatory_rule_sets set
  last_verified_at = '2026-07-09T00:00:00Z',
  verified_by = 'seed:0013',
  source_note = case code
    when 'CSL_2025_1506' then 'Verifierad mot SFS 2025:1506 (riksdagen.se). I kraft 2026-01-15.'
    when 'CSF_2025_1507' then 'Verifierad mot SFS 2025:1507 (riksdagen.se). I kraft 2026-01-15, ändrad t.o.m. SFS 2026:623.'
    when 'MCFFS_2026_1' then 'Verifierad mot MCFFS 2026:1 (mcf.se). Registrering/anmälan — deadline 2026-02-16 har passerat; sen registrering är fortfarande bättre än ingen.'
    when 'MCFFS_2026_7' then 'Verifierad mot MCFFS 2026:7 (mcf.se). Statliga myndigheter.'
    when 'MCFFS_2026_8' then 'Verifierad mot MCFFS 2026:8 (mcf.se). I kraft 2026-07-01. Rapportering via cyberportalen till NCSC/CERT-SE.'
    when 'MCFFS_2026_11' then 'MCFFS 2026:11 träder i kraft 2026-10-01 — status pending tills vägledning finns.'
    when 'MCFFS_2026_12' then 'MCFFS 2026:12 träder i kraft 2026-10-01 — status pending tills vägledning finns.'
    when 'EU_2024_2690' then 'Verifierad mot (EU) 2024/2690 (EUR-Lex). Gäller relevanta digitala sektorer.'
    when 'GDPR_PERSONAL_DATA_BREACH' then 'Art. 33-34 GDPR: anmälan till IMY normalt inom 72 timmar från kännedom.'
    when 'EIDAS_TRUST_SERVICE' then 'Art. 19 eIDAS: betrodda tjänster, tillsyn PTS.'
    when 'PTS_RULE_TRACK' then 'PTS sektorsföreskrifter ej slutliga — partial coverage, manuell bedömning krävs.'
    else source_note
  end
where code in (
  'CSL_2025_1506', 'CSF_2025_1507', 'MCFFS_2026_1', 'MCFFS_2026_7',
  'MCFFS_2026_8', 'MCFFS_2026_11', 'MCFFS_2026_12', 'EU_2024_2690',
  'GDPR_PERSONAL_DATA_BREACH', 'EIDAS_TRUST_SERVICE', 'PTS_RULE_TRACK'
);
