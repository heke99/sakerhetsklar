import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Säkerhetsklar",
    template: "%s | Säkerhetsklar",
  },
  description:
    "Säkerhetsklar – svensk plattform för NIS2/cybersäkerhetslagen: omfattningsbedömning, readiness, incidenthantering och rapporteringsunderlag.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
