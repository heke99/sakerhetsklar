import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 rounded-full border border-slate-700 px-4 py-1 text-sm text-slate-300">
          NIS2 Control Center
        </p>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Svensk plattform för NIS2, incidentrapportering och Cyberportalen-underlag.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          Bedöm om organisationen omfattas, bygg NIS2-readiness, hantera incidenter,
          skapa rapportunderlag och följ deadlines.
        </p>

        <div className="mt-8 flex gap-4">
          <Link
            href="/app/overview"
            className="rounded-lg bg-white px-5 py-3 font-medium text-slate-950"
          >
            Öppna kundvy
          </Link>

          <Link
            href="/platform"
            className="rounded-lg border border-slate-700 px-5 py-3 font-medium text-white"
          >
            Öppna superadmin
          </Link>
        </div>
      </section>
    </main>
  );
}
