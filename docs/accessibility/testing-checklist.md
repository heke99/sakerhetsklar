# Tillgänglighetstestning — checklista (WCAG 2.1 AA / EN 301 549)

Körs före varje större release. Resultat och kända brister registreras i
bristregistret.

## Tangentbord

- [ ] Alla interaktiva element nås med Tab/Skift+Tab i logisk ordning.
- [ ] Synlig fokusmarkering på alla fokuserbara element.
- [ ] Inga tangentbordsfällor; dialoger kan stängas med Esc.
- [ ] Expanderbara paneler (lathundar, kontroller) har `aria-expanded`.

## Skärmläsare

- [ ] Alla formulärfält har kopplade `<label>`/`aria-label`.
- [ ] Felmeddelanden annonseras (`role="alert"`).
- [ ] Statusbrickor har textinnehåll (inte enbart färg/ikon).
- [ ] Tabeller har `<th>`-rubriker; navigation har `aria-label` och
      `aria-current`.
- [ ] Sidor har unika titlar och `lang="sv"`.

## Visuellt

- [ ] Kontrast minst 4,5:1 för brödtext, 3:1 för stor text och UI-komponenter.
- [ ] Information förmedlas aldrig enbart med färg (statusfärger kompletteras
      med text).
- [ ] Layouten fungerar vid 200 % zoom och på små skärmar (responsiv).
- [ ] Fokusordning följer visuell ordning.

## Formulär och fel

- [ ] Obligatoriska fält är markerade i etiketten.
- [ ] Fel beskriver vad som är fel och hur det åtgärdas, på svenska.
- [ ] `aria-invalid` sätts på ogiltiga fält.

## Exporter

- [ ] PDF-exporter har dokumenttitel och läsordning där möjligt.
- [ ] Word-exporter använder rubriknivåer.

## Automatiserade kontroller

- [ ] axe/Lighthouse-körning utan kritiska fel på huvudsidorna
      (översikt, onboarding, incidenter, rapporter, kontroller).

## Bristregister

| Datum | Sida/komponent | Brist | WCAG-kriterium | Planerad åtgärd |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
