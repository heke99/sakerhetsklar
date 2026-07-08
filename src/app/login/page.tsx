import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata = { title: "Logga in" };

const trustItems = [
  "Cyberportalen-underlag och deadlinebevakning",
  "Incidentbeslut med spårbara regelkällor",
  "Bevisbank, audit trail och support access-loggning",
  "Readiness för NIS2, GDPR/IMY och parallella rapporteringsspår",
];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-slate-950 text-white lg:grid-cols-[1fr_0.9fr]">
      <section className="relative hidden overflow-hidden border-r border-white/10 px-10 py-10 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.32),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.18),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]" />

        <Link href="/" className="flex items-center gap-3" aria-label="Till startsidan">
          <span className="flex size-11 items-center justify-center rounded-xl bg-white text-sm font-black text-slate-950">
            SK
          </span>
          <span>
            <span className="block text-lg font-semibold tracking-tight">Säkerhetsklar</span>
            <span className="block text-xs text-slate-400">NIS2 / Cybersäkerhetslagen</span>
          </span>
        </Link>

        <div className="max-w-xl">
          <p className="mb-5 inline-flex w-fit rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-sm font-medium text-blue-100">
            Svensk enterpriseplattform för samhällsviktig verksamhet
          </p>
          <h1 className="text-5xl font-semibold tracking-tight">
            Logga in till ett säkert kontrollcenter för NIS2 och incidentrapportering.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Hantera omfattningsbedömning, readiness, incidenter, rapportunderlag, bevis och ledningsbeslut med tydliga ägare och spårbara beslut.
          </p>

          <div className="mt-8 grid gap-3">
            {trustItems.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200">
                <span className="mt-1 size-2.5 shrink-0 rounded-full bg-emerald-300" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="max-w-xl text-sm leading-6 text-slate-400">
          Åtkomst loggas. Använd inte delade konton. Kontakta administratören om du saknar behörighet eller inte kan nå rätt tenant.
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-3" aria-label="Till startsidan">
              <span className="flex size-10 items-center justify-center rounded-xl bg-white text-sm font-black text-slate-950">
                SK
              </span>
              <span>
                <span className="block text-base font-semibold tracking-tight">Säkerhetsklar</span>
                <span className="block text-xs text-slate-400">NIS2 / Cybersäkerhetslagen</span>
              </span>
            </Link>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-2 shadow-2xl shadow-slate-950/50 backdrop-blur">
            <div className="rounded-[1.25rem] border border-white/10 bg-white p-6 text-slate-950 shadow-sm sm:p-8">
              <div className="mb-7">
                <p className="text-sm font-medium text-blue-700">Säker inloggning</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Logga in till Säkerhetsklar
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Använd ditt organisationskonto eller e-post och lösenord.
                </p>
              </div>

              <Suspense fallback={<div className="text-sm text-slate-600">Laddar inloggning…</div>}>
                <LoginForm />
              </Suspense>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-sm text-slate-400">
            <Link href="/" className="transition hover:text-white">
              Till startsidan
            </Link>
            <Link href="/platform" className="transition hover:text-white">
              Plattformsvy
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
