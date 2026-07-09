"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteInfo {
  email: string;
  tenantName: string;
  roleCode: string;
  userExists: boolean;
}

type Phase = "loading" | "invalid" | "new_user" | "existing_user" | "accepted";

export function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setPhase("invalid");
        return;
      }
      const res = await fetch("/api/v1/invitations/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (cancelled) return;
      if (!res.ok) {
        setPhase("invalid");
        return;
      }
      const { data } = (await res.json()) as { data: InviteInfo };
      setInfo(data);
      setPhase(data.userExists ? "existing_user" : "new_user");
    })().catch(() => {
      if (!cancelled) setPhase("invalid");
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = useCallback(
    async (withPassword?: string) => {
      setError(null);
      setBusy(true);
      try {
        const res = await fetch("/api/v1/invitations/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            ...(withPassword ? { password: withPassword } : {}),
          }),
        });
        const body = (await res.json()) as {
          data?: { status: string; email: string };
          error?: { message: string };
        };
        if (!res.ok) {
          setError(body.error?.message ?? "Inbjudan kunde inte accepteras.");
          return;
        }
        if (body.data?.status === "requires_login") {
          router.push(
            `/login?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`,
          );
          return;
        }
        // New account: sign in with the freshly set password.
        if (withPassword && info) {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          if (url && anonKey) {
            const supabase = createBrowserClient(url, anonKey);
            await supabase.auth.signInWithPassword({
              email: info.email,
              password: withPassword,
            });
          }
        }
        setPhase("accepted");
        setTimeout(() => {
          router.push("/app/overview");
          router.refresh();
        }, 1200);
      } finally {
        setBusy(false);
      }
    },
    [token, info, router],
  );

  if (phase === "loading") {
    return <p className="text-sm text-slate-600">Kontrollerar inbjudan…</p>;
  }

  if (phase === "invalid") {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          Inbjudan är ogiltig, har återkallats eller har upphört att gälla.
          Kontakta din administratör för en ny inbjudan.
        </div>
        <p className="text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-blue-700 hover:text-blue-900">
            Till inloggning
          </Link>
        </p>
      </div>
    );
  }

  if (phase === "accepted") {
    return (
      <div
        role="status"
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"
      >
        Inbjudan accepterad. Du skickas vidare…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
        Du har blivit inbjuden till <strong>{info?.tenantName}</strong> som{" "}
        <strong>{info?.roleCode}</strong> med e-postadressen{" "}
        <strong>{info?.email}</strong>.
      </div>

      {phase === "existing_user" ? (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            Det finns redan ett konto för {info?.email}. Logga in för att
            acceptera inbjudan.
          </p>
          <Button
            type="button"
            disabled={busy}
            onClick={() => accept()}
            className="h-11 w-full text-sm font-semibold"
          >
            {busy ? "Accepterar…" : "Acceptera inbjudan"}
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (password.length < 12) {
              setError("Lösenordet måste vara minst 12 tecken.");
              return;
            }
            if (password !== passwordRepeat) {
              setError("Lösenorden matchar inte.");
              return;
            }
            void accept(password);
          }}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-800">
              Välj lösenord
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Minst 12 tecken"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 border-slate-300 bg-white px-3 text-slate-950 placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-repeat" className="text-slate-800">
              Upprepa lösenordet
            </Label>
            <Input
              id="password-repeat"
              type="password"
              autoComplete="new-password"
              placeholder="Upprepa lösenordet"
              value={passwordRepeat}
              onChange={(e) => setPasswordRepeat(e.target.value)}
              className="h-11 border-slate-300 bg-white px-3 text-slate-950 placeholder:text-slate-400"
            />
          </div>
          <Button type="submit" disabled={busy} className="h-11 w-full text-sm font-semibold">
            {busy ? "Skapar konto…" : "Skapa konto och acceptera"}
          </Button>
        </form>
      )}

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
