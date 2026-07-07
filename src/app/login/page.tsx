import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata = { title: "Logga in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Säkerhetsklar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Logga in för att fortsätta
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
