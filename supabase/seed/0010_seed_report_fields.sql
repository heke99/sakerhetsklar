-- Report field definitions for Cyberportalen copy mode (spec §18).
-- Every field carries its source rule and legal reference. No real PII.

insert into public.report_field_definitions
  (report_stage, field_key, label_sv, copy_label, field_type, required, help_text_sv, source_rule_code, legal_reference, sort_order)
values
  -- 1. Early warning / Upplysning — 24h ---------------------------------------
  ('early_warning_24h', 'organization_name', 'Organisationsnamn', 'Organisationsnamn', 'text', true, 'Verksamhetsutövarens registrerade namn.', 'DL_EARLY_WARNING_24H', 'MCFFS 2026:8', 10),
  ('early_warning_24h', 'organization_number', 'Organisationsnummer', 'Organisationsnummer', 'text', true, null, 'DL_EARLY_WARNING_24H', 'MCFFS 2026:8', 20),
  ('early_warning_24h', 'contact_details', 'Kontaktuppgifter', 'Kontaktuppgifter', 'textarea', true, 'Namn, e-post och telefon till kontaktperson för incidenten.', 'DL_EARLY_WARNING_24H', 'MCFFS 2026:8', 30),
  ('early_warning_24h', 'incident_ongoing', 'Pågår incidenten?', 'Pågår incidenten', 'boolean', true, null, 'DL_EARLY_WARNING_24H', 'MCFFS 2026:8', 40),
  ('early_warning_24h', 'event_timeline', 'Händelseförlopp', 'Händelseförlopp', 'textarea', true, 'Kortfattad tidslinje över vad som hänt.', 'DL_EARLY_WARNING_24H', 'MCFFS 2026:8', 50),
  ('early_warning_24h', 'detected_at', 'När upptäcktes incidenten?', 'Tidpunkt för upptäckt', 'datetime', true, null, 'DL_EARLY_WARNING_24H', 'MCFFS 2026:8', 60),
  ('early_warning_24h', 'detection_method', 'Hur upptäcktes incidenten?', 'Hur incidenten upptäcktes', 'textarea', true, null, 'DL_EARLY_WARNING_24H', 'MCFFS 2026:8', 70),
  ('early_warning_24h', 'suspected_malicious', 'Misstänks antagonistisk/olaglig handling?', 'Misstanke om antagonistisk eller olaglig handling', 'boolean', true, null, 'DL_EARLY_WARNING_24H', 'MCFFS 2026:8', 80),
  ('early_warning_24h', 'supplier_origin', 'Har incidenten sitt ursprung hos leverantör?', 'Leverantörsursprung', 'boolean', false, 'Ange om tillämpligt.', 'DL_EARLY_WARNING_24H', 'MCFFS 2026:8', 90),
  ('early_warning_24h', 'sector_activity_impact', 'Påverkan på sektorsverksamheten', 'Påverkan på sektorsverksamheten', 'textarea', true, null, 'DL_EARLY_WARNING_24H', 'MCFFS 2026:8', 100),
  ('early_warning_24h', 'consequences', 'Konsekvenser eller riskerade konsekvenser', 'Konsekvenser eller riskerade konsekvenser', 'textarea', true, null, 'DL_EARLY_WARNING_24H', 'MCFFS 2026:8', 110),
  ('early_warning_24h', 'cross_border', 'Gränsöverskridande konsekvenser', 'Gränsöverskridande konsekvenser', 'textarea', false, 'Beskriv eventuell påverkan i andra länder.', 'DL_EARLY_WARNING_24H', 'MCFFS 2026:8', 120),

  -- 2. Incident notification / Incidentanmälan — 72h ----------------------------
  ('incident_notification_72h', 'early_warning_update', 'Uppdatering av upplysningen', 'Uppdatering av tidigare lämnad upplysning', 'textarea', true, 'Vad har förändrats sedan 24h-upplysningen?', 'DL_NOTIFICATION_72H', 'MCFFS 2026:8', 10),
  ('incident_notification_72h', 'occurred_at', 'När inträffade incidenten?', 'Tidpunkt då incidenten inträffade', 'datetime', true, null, 'DL_NOTIFICATION_72H', 'MCFFS 2026:8', 20),
  ('incident_notification_72h', 'ended_at', 'När upphörde incidenten (eller förväntas upphöra)?', 'Tidpunkt då incidenten upphörde/förväntas upphöra', 'datetime', false, null, 'DL_NOTIFICATION_72H', 'MCFFS 2026:8', 30),
  ('incident_notification_72h', 'cause_assessment', 'Orsaksbedömning', 'Bedömning av orsak', 'textarea', true, null, 'DL_NOTIFICATION_72H', 'MCFFS 2026:8', 40),
  ('incident_notification_72h', 'system_impact', 'Systempåverkan', 'Påverkan på system', 'textarea', true, null, 'DL_NOTIFICATION_72H', 'MCFFS 2026:8', 50),
  ('incident_notification_72h', 'indicators_of_compromise', 'Angreppsindikatorer (IoC)', 'Angreppsindikatorer', 'textarea', false, 'Där tillämpligt.', 'DL_NOTIFICATION_72H', 'MCFFS 2026:8', 60),
  ('incident_notification_72h', 'protected_information_impact', 'Påverkan på skyddad information', 'Påverkan på skyddad information', 'textarea', false, 'Där tillämpligt.', 'DL_NOTIFICATION_72H', 'MCFFS 2026:8', 70),
  ('incident_notification_72h', 'actions_taken', 'Vidtagna åtgärder', 'Vidtagna åtgärder', 'textarea', true, null, 'DL_NOTIFICATION_72H', 'MCFFS 2026:8', 80),
  ('incident_notification_72h', 'remaining_risks', 'Kvarstående risker', 'Kvarstående risker', 'textarea', true, null, 'DL_NOTIFICATION_72H', 'MCFFS 2026:8', 90),

  -- 3. Final report — within one month -------------------------------------------
  ('final_report', 'final_consequences', 'Slutlig konsekvensbedömning', 'Slutlig konsekvensbedömning', 'textarea', true, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 10),
  ('final_report', 'affected_recipients_estimate', 'Uppskattat antal berörda mottagare', 'Uppskattat antal berörda mottagare', 'number', true, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 20),
  ('final_report', 'geographic_area', 'Geografiskt område', 'Geografiskt område', 'textarea', true, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 30),
  ('final_report', 'economic_damage', 'Ekonomisk skada', 'Ekonomisk skada', 'textarea', true, 'Inkludera kostnadskategorier: återställning, extern respons, juridik, forensik, sanering, personal, viten, förlorade intäkter.', 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 40),
  ('final_report', 'cross_border_final', 'Gränsöverskridande konsekvenser', 'Gränsöverskridande konsekvenser', 'textarea', false, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 50),
  ('final_report', 'societal_functions_impact', 'Påverkan på viktiga samhällsfunktioner', 'Påverkan på viktiga samhällsfunktioner', 'textarea', true, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 60),
  ('final_report', 'root_cause', 'Detaljerad grundorsak', 'Detaljerad grundorsak', 'textarea', true, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 70),
  ('final_report', 'technical_measures', 'Tekniska åtgärder', 'Vidtagna tekniska åtgärder', 'textarea', true, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 80),
  ('final_report', 'organizational_measures', 'Organisatoriska åtgärder', 'Vidtagna organisatoriska åtgärder', 'textarea', true, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 90),
  ('final_report', 'mitigation_measures', 'Åtgärder för att minimera konsekvenser', 'Åtgärder för att minimera konsekvenser', 'textarea', true, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 100),
  ('final_report', 'recurrence_prevention', 'Åtgärder för att förhindra upprepning', 'Åtgärder för att förhindra upprepning', 'textarea', true, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 110),
  ('final_report', 'management_approval', 'Ledningens godkännande', 'Ledningens godkännande', 'text', true, 'Namn och roll för den i ledningen som godkänt rapporten.', 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 120),

  -- 4. Situation report / Lägesrapport ---------------------------------------------
  ('situation_report', 'why_ongoing', 'Varför pågår incidenten fortfarande?', 'Varför incidenten fortfarande pågår', 'textarea', true, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 10),
  ('situation_report', 'estimated_duration', 'Uppskattad varaktighet', 'Uppskattad varaktighet', 'textarea', true, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 20),
  ('situation_report', 'continued_impact', 'Fortsatt påverkan', 'Fortsatt påverkan', 'textarea', true, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 30),
  ('situation_report', 'indicators_of_compromise_situation', 'Angreppsindikatorer (IoC)', 'Angreppsindikatorer', 'textarea', false, 'Där tillämpligt.', 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 40),
  ('situation_report', 'next_update_plan', 'Plan för nästa uppdatering', 'Plan för nästa uppdatering', 'textarea', true, null, 'DL_FINAL_REPORT_1M', 'MCFFS 2026:8', 50),

  -- State agency 6h warning (MCFFS 2026:7) --------------------------------------------
  ('state_agency_6h', 'agency_name', 'Myndighetens namn', 'Myndighetens namn', 'text', true, null, 'SA_DL_WARNING_6H', 'MCFFS 2026:7', 10),
  ('state_agency_6h', 'warning_summary', 'Kort beskrivning av händelsen', 'Kort beskrivning av händelsen', 'textarea', true, null, 'SA_DL_WARNING_6H', 'MCFFS 2026:7', 20),
  ('state_agency_6h', 'assessed_impact', 'Bedömd påverkan', 'Bedömd påverkan', 'textarea', true, null, 'SA_DL_WARNING_6H', 'MCFFS 2026:7', 30),
  ('state_agency_6h', 'contact_details_sa', 'Kontaktuppgifter', 'Kontaktuppgifter', 'textarea', true, null, 'SA_DL_WARNING_6H', 'MCFFS 2026:7', 40),

  -- IMY report (GDPR track) --------------------------------------------------------------
  ('imy_report', 'breach_description', 'Beskrivning av personuppgiftsincidenten', 'Beskrivning av incidenten', 'textarea', true, null, 'GDPR_TRACK_TRIGGER', 'GDPR art. 33.3a', 10),
  ('imy_report', 'data_categories', 'Kategorier av personuppgifter', 'Kategorier av personuppgifter', 'textarea', true, null, 'GDPR_TRACK_TRIGGER', 'GDPR art. 33.3a', 20),
  ('imy_report', 'data_subjects_count', 'Antal registrerade (uppskattning)', 'Antal berörda registrerade', 'number', true, null, 'GDPR_TRACK_TRIGGER', 'GDPR art. 33.3a', 30),
  ('imy_report', 'likely_consequences', 'Sannolika konsekvenser', 'Sannolika konsekvenser', 'textarea', true, null, 'GDPR_TRACK_TRIGGER', 'GDPR art. 33.3c', 40),
  ('imy_report', 'measures_taken_gdpr', 'Vidtagna och planerade åtgärder', 'Vidtagna och planerade åtgärder', 'textarea', true, null, 'GDPR_TRACK_TRIGGER', 'GDPR art. 33.3d', 50),
  ('imy_report', 'dpo_contact', 'Kontaktuppgifter till dataskyddsombud', 'Dataskyddsombudets kontaktuppgifter', 'textarea', true, null, 'GDPR_TRACK_TRIGGER', 'GDPR art. 33.3b', 60)
on conflict (report_stage, field_key) do nothing;

-- Report templates registry.
insert into public.report_templates (code, report_stage, name_sv, description_sv)
values
  ('EARLY_WARNING_24H', 'early_warning_24h', 'Upplysning (24 timmar)', 'Tidig upplysning till Cyberportalen inom 24 timmar.'),
  ('INCIDENT_NOTIFICATION_72H', 'incident_notification_72h', 'Incidentanmälan (72 timmar)', 'Incidentanmälan till Cyberportalen inom 72 timmar.'),
  ('FINAL_REPORT', 'final_report', 'Slutrapport', 'Slutrapport senast en månad efter incidentanmälan.'),
  ('SITUATION_REPORT', 'situation_report', 'Lägesrapport', 'Lägesrapport när incidenten fortfarande pågår vid slutrapporttidpunkten.'),
  ('STATE_AGENCY_6H', 'state_agency_6h', 'Statlig varning (6 timmar)', 'Varning för statliga myndigheter enligt beredskapsspåret.'),
  ('IMY_REPORT', 'imy_report', 'Anmälan till IMY', 'Personuppgiftsincidentanmälan till IMY.')
on conflict (code) do nothing;
