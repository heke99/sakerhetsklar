"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Phase = "request" | "sent" | "update" | "done";

function getClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // When the user arrives from the recovery e-mail link, Supabase establishes
  // a recovery session (code/token in the URL). Detect it and switch to the
  // "set new password" phase.
  useEffect(() => {
    const supabase = getClient();
    if (!supabase) return;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");

    async function detect() {
      if (!supabase) return;
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(window.location.href);
        if (!exchangeError) setPhase("update");
        return;
      }
      if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });
        if (!verifyError) setPhase("update");
        return;
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setPhase("update");
    });
    void detect();
    return () => sub.subscription.unsubscribe();
  }, []);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = getClient();
    if (!supabase) {
      setError("Miljön är inte konfigurerad. Kontakta administratören.");
      return;
    }
    setBusy(true);
    // Never reveal whether the account exists: always show the same message.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    setPhase("sent");
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError("Lösenordet måste vara minst 12 tecken.");
      return;
    }
    if (password !== passwordRepeat) {
      setError("Lösenorden matchar inte.");
      return;
    }
    const supabase = getClient();
    if (!supabase) {
      setError("Miljön är inte konfigurerad. Kontakta administratören.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(
        "Lösenordet kunde inte uppdateras. Länken kan ha upphört — begär en ny återställningslänk.",
      );
      return;
    }
    setPhase("done");
    setTimeout(() => {
      router.push("/app/overview");
      router.refresh();
    }, 1500);
  }

  if (phase === "sent") {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"
        >
          Om e-postadressen finns registrerad har vi skickat en länk för att
          återställa lösenordet. Kontrollera inkorgen och skräpposten.
        </div>
        <p className="text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-blue-700 hover:text-blue-900">
            Tillbaka till inloggning
          </Link>
        </p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div
        role="status"
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"
      >
        Lösenordet är uppdaterat. Du loggas in…
      </div>
    );
  }

  if (phase === "update") {
    return (
      <form onSubmit={updatePassword} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="new-password" className="text-slate-800">
            Nytt lösenord
          </Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="Minst 12 tecken"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 border-slate-300 bg-white px-3 text-slate-950 placeholder:text-slate-400"
          />
          <p className="text-xs text-slate-500">
            Minst 12 tecken. Använd gärna en lösenordshanterare.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="repeat-password" className="text-slate-800">
            Upprepa lösenordet
          </Label>
          <Input
            id="repeat-password"
            type="password"
            autoComplete="new-password"
            placeholder="Upprepa lösenordet"
            value={passwordRepeat}
            onChange={(e) => setPasswordRepeat(e.target.value)}
            className="h-11 border-slate-300 bg-white px-3 text-slate-950 placeholder:text-slate-400"
          />
        </div>
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
          >
            {error}
          </div>
        ) : null}
        <Button type="submit" disabled={busy} className="h-11 w-full text-sm font-semibold">
          {busy ? "Sparar…" : "Spara nytt lösenord"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={requestReset} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-slate-800">
          E-postadress
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="namn@organisation.se"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 border-slate-300 bg-white px-3 text-slate-950 placeholder:text-slate-400"
        />
      </div>
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          {error}
        </div>
      ) : null}
      <Button
        type="submit"
        disabled={busy || !email}
        className="h-11 w-full text-sm font-semibold"
      >
        {busy ? "Skickar…" : "Skicka återställningslänk"}
      </Button>
      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="font-medium text-blue-700 hover:text-blue-900">
          Tillbaka till inloggning
        </Link>
      </p>
    </form>
  );
}
