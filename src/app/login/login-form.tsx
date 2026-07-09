"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNextPath } from "@/lib/auth/safe-next";

const schema = z.object({
  email: z.string().email("Ange en giltig e-postadress"),
  password: z.string().min(1, "Ange lösenord"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setError(null);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      setError("Miljön är inte konfigurerad. Kontakta administratören.");
      return;
    }

    const supabase = createBrowserClient(url, anonKey);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (signInError) {
      setError("Fel e-postadress eller lösenord. Kontrollera uppgifterna och försök igen.");
      return;
    }

    router.push(safeNextPath(searchParams.get("next")));
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-800">
            E-postadress
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="namn@organisation.se"
            aria-invalid={Boolean(errors.email)}
            className="h-11 border-slate-300 bg-white px-3 text-slate-950 placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
            {...register("email")}
          />
          {errors.email ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password" className="text-slate-800">
              Lösenord
            </Label>
            <Link
              href="/reset-password"
              className="text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              Glömt lösenord?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Ange lösenord"
            aria-invalid={Boolean(errors.password)}
            className="h-11 border-slate-300 bg-white px-3 text-slate-950 placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
            {...register("password")}
          />
          {errors.password ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        {error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {error}
          </div>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="h-11 w-full text-sm font-semibold">
          {isSubmitting ? "Loggar in…" : "Logga in"}
        </Button>
      </form>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
        Åtkomst loggas. Använd inte delade konton. Kontakta administratör om du saknar behörighet eller rätt tenant.
      </div>

      <p className="text-center text-sm text-slate-500">
        Problem att logga in? Kontakta er tenant-administratör eller plattformsansvarig.
      </p>
    </div>
  );
}
