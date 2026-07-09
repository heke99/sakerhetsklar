import Link from "next/link";

export const metadata = { title: "Åtkomst blockerad" };

const MESSAGES: Record<string, { title: string; body: string }> = {
  sso_required: {
    title: "Organisationen kräver inloggning via SSO",
    body: "Er organisation har konfigurerat att inloggning ska ske via organisationens identitetsleverantör (SSO). Inloggning med lösenord är inte tillåten. Kontakta er organisationsadministratör för att få tillgång, eller be administratören slutföra SSO-konfigurationen.",
  },
  mfa_required: {
    title: "Organisationen kräver tvåfaktorsautentisering",
    body: "Er organisation kräver tvåfaktorsautentisering (MFA) för alla användare. Ditt konto har ännu inte en andra faktor registrerad. Kontakta er organisationsadministratör för att aktivera MFA för ditt konto.",
  },
};

export default async function AuthBlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = MESSAGES[reason ?? ""] ?? {
    title: "Åtkomst blockerad",
    body: "Din åtkomst uppfyller inte organisationens säkerhetskrav. Kontakta er organisationsadministratör.",
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 text-slate-950 shadow-2xl">
        <p className="text-sm font-medium text-red-700">Säkerhetskrav</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{message.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message.body}</p>
        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/login" className="font-medium text-blue-700 hover:text-blue-900">
            Tillbaka till inloggning
          </Link>
          <Link href="/" className="text-slate-500 hover:text-slate-800">
            Till startsidan
          </Link>
        </div>
      </div>
    </main>
  );
}
