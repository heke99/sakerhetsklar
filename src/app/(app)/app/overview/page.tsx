const cards = [
  {
    title: "NIS2-status",
    value: "Ej bedömd",
    description: "Starta onboarding för att skapa regelprofil.",
  },
  {
    title: "Readiness",
    value: "0%",
    description: "Inga kontroller är ännu genomförda.",
  },
  {
    title: "Rapporteringsberedskap",
    value: "0%",
    description: "Incidentroller och Cyberportalen-flöde saknas.",
  },
  {
    title: "Öppna incidenter",
    value: "0",
    description: "Inga incidenter registrerade.",
  },
];

export default function CustomerOverviewPage() {
  return (
    <main className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Översikt</h1>
        <p className="mt-2 text-muted-foreground">
          Här ser kunden sin NIS2-status, readiness, incidentberedskap och nästa steg.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">{card.title}</p>
            <p className="mt-3 text-3xl font-bold">{card.value}</p>
            <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
