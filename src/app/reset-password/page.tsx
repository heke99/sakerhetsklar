import Link from "next/link";
import { Suspense } from "react";

import { ResetPasswordForm } from "./reset-form";

export const metadata = { title: "Återställ lösenord" };

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8">
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
              <p className="text-sm font-medium text-blue-700">Kontoåterställning</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Återställ lösenord
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ange din e-postadress så skickar vi en återställningslänk.
              </p>
            </div>

            <Suspense fallback={<div className="text-sm text-slate-600">Laddar…</div>}>
              <ResetPasswordForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
