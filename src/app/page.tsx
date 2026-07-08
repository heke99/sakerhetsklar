import Link from "next/link";

const featureCards = [
  {
    title: "Omfattas vi?",
    description:
      "Bedöm sektor, storlek, juridisk enhet och tillsynsmyndighet med spårbara regelkällor.",
  },
  {
    title: "Är vi redo?",
    description:
      "Följ readiness, kontroller, saknade ägare, bevis, risker och ledningsåtgärder.",
  },
  {
    title: "Är incidenten rapporterbar?",
    description:
      "Bedöm betydande incident, GDPR/IMY, PTS/eIDAS, avtal och försäkring i separata spår.",
  },
  {
    title: "Rapportera i tid",
    description:
      "Skapa underlag för 24h upplysning, 72h incidentanmälan, slutrapport och lägesrapport.",
  },
];

const platformModules = [
  "Omfattningsbedömning",
  "Regelmotor",
  "Readiness-kontroller",
  "System- och tjänsteregister",
  "Leverantörsrisk",
  "Incidenthantering",
  "Cyberportalen-underlag",
  "Deadlinebevakning",
  "Bevisbank",
  "Ledningsrapport",
  "Tillsynspaket",
  "Support access-loggning",
];

const audiences = [
  "Kommuner och kommunala bolag",
  "VA och dricksvatten",
  "Energi och fjärrvärme",
  "Myndigheter",
  "Vård och omsorg",
  "Digital infrastruktur",
  "MSP/MSSP och molnaktörer",
  "Leverantörer till samhällsviktig verksamhet",
];

const securityItems = [
  "Rollbaserad åtkomst och tenant-isolering",
  "Audit logs för kritiska beslut och åtkomst",
  "Support access med syfte, godkännande och tidsgräns",
  "Beviskedja med filhashar och åtkomstloggar",
  "Manuell granskning när regelstöd är delvis eller oklart",
  "Beslutsstöd – inte automatisk juridisk rådgivning",
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_34%),radial-gradient(circle_at_top_right,rgba(20,184,166,0.16),transparent_32%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#111827_100%)]" />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Säkerhetsklar startsida">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white text-sm font-black tracking-tight text-slate-950 shadow-lg shadow-blue-950/30">
            SK
          </span>
          <span>
            <span className="block text-base font-semibold tracking-tight">Säkerhetsklar</span>
            <span className="block text-xs text-slate-400">NIS2 / Cybersäkerhetslagen</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex" aria-label="Huvudnavigation">
          <a href="#plattform" className="transition hover:text-white">
            Plattform
          </a>
          <a href="#incident" className="transition hover:text-white">
            Incidentrapportering
          </a>
          <a href="#malgrupper" className="transition hover:text-white">
            För organisationer
          </a>
          <a href="#sakerhet" className="transition hover:text-white">
            Säkerhet
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/10"
          >
            Logga in
          </Link>
          <Link
            href="/app/overview"
            className="hidden rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:inline-flex"
          >
            Se demoöversikt
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-28 lg:pt-20">
        <div className="flex flex-col justify-center">
          <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-sm font-medium text-blue-100">
            <span className="size-2 rounded-full bg-emerald-400" aria-hidden="true" />
            Byggd för svenska krav, incidentflöden och Cyberportalen-underlag
          </p>

          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Hantera NIS2, incidenter och rapportering med ett tydligt operativt kontrollcenter.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Säkerhetsklar hjälper svenska organisationer att bedöma omfattning, bygga readiness,
            följa deadlines, samla bevis och skapa rapportunderlag för Cyberportalen, IMY och andra
            parallella rapporteringsspår.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-blue-950/20 transition hover:bg-slate-100"
            >
              Logga in
            </Link>
            <Link
              href="/app/overview"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/35 hover:bg-white/10"
            >
              Öppna demoöversikt
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
            {[
              "Kommuner",
              "VA",
              "Energi",
              "Myndigheter",
              "Digital infrastruktur",
              "Samhällsviktig verksamhet",
            ].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-blue-500/10 blur-2xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-slate-950/50 backdrop-blur">
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm text-slate-400">Översikt</p>
                  <h2 className="mt-1 text-xl font-semibold">Rapporteringsberedskap</h2>
                </div>
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  Aktiv
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["NIS2-readiness", "78%", "11 åtgärder kvar"],
                  ["Rapportering", "92%", "Cyberportalen-copy redo"],
                  ["Incidenter", "2", "1 kräver granskning"],
                  ["Bevis", "46", "hashade filer"],
                ].map(([label, value, meta]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm text-slate-400">{label}</p>
                    <p className="mt-2 text-3xl font-semibold">{value}</p>
                    <p className="mt-1 text-xs text-slate-400">{meta}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                <p className="text-sm font-medium text-amber-100">Nästa kritiska åtgärd</p>
                <p className="mt-2 text-sm leading-6 text-amber-50/90">
                  24h upplysning saknar juridiskt godkännande. Deadline: idag 14:30.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  "CISO granskar betydande incident",
                  "DPO bedömer personuppgiftsincident",
                  "Ledning godkänner slutrapport",
                ].map((task) => (
                  <div key={task} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-slate-200">
                    <span className="size-2 rounded-full bg-blue-300" aria-hidden="true" />
                    {task}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03]" aria-label="Produktvärden">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {featureCards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-base font-semibold">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="plattform" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Plattform</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Allt samlat i ett operativt kontrollcenter.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-300">
              Från första omfattningsbedömningen till incidentbeslut, deadlines, bevis, rapportunderlag,
              ledningsrapport och tillsynspaket. UI:t visar status, ägare, nästa steg och regelkälla.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {platformModules.map((module) => (
              <div key={module} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-100">
                <span className="size-2.5 rounded-full bg-emerald-300" aria-hidden="true" />
                {module}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="incident" className="border-y border-white/10 bg-slate-900/50">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-3 lg:px-8">
          <div className="lg:col-span-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Incidentrapportering</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Rapportera rätt sak i rätt tid.</h2>
          </div>
          <div className="grid gap-4 lg:col-span-2 sm:grid-cols-2">
            {[
              ["24h upplysning", "Tidiga uppgifter, misstänkt orsak, påverkan och riskerade konsekvenser."],
              ["72h incidentanmälan", "Uppdaterad bedömning, systempåverkan, åtgärder och kvarvarande risker."],
              ["Slutrapport", "Konsekvens, rotorsak, tekniska/organisatoriska åtgärder och ledningsgodkännande."],
              ["Parallella spår", "GDPR/IMY, PTS/eIDAS, avtal och försäkring hålls separata och spårbara."],
            ].map(([title, description]) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="malgrupper" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Målgrupper</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Byggd för svenska organisationer med höga krav.
          </h2>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map((audience) => (
            <div key={audience} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200">
              {audience}
            </div>
          ))}
        </div>
      </section>

      <section id="sakerhet" className="border-t border-white/10 bg-white/[0.03]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Säkerhet</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Säkerhets- och revisionsspår från början.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-300">
              Säkerhetsklar ska hjälpa organisationen att agera kontrollerat, dokumenterat och granskningsbart – även när regler eller sektorskrav kräver manuell bedömning.
            </p>
          </div>

          <div className="grid gap-3">
            {securityItems.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
                <span className="mt-1 size-2.5 shrink-0 rounded-full bg-blue-300" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Kom igång med Säkerhetsklar.</h2>
        <p className="mt-4 text-base leading-7 text-slate-300">
          Logga in för att fortsätta till kundvy, superadmin eller incidentarbete. Demoöversikten finns kvar för intern verifiering.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Logga in
          </Link>
          <Link
            href="/app/overview"
            className="inline-flex items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/35 hover:bg-white/10"
          >
            Gå till kundvy
          </Link>
          <Link
            href="/platform"
            className="inline-flex items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/35 hover:bg-white/10 hover:text-white"
          >
            Plattformsvy
          </Link>
        </div>
      </section>
    </main>
  );
}
