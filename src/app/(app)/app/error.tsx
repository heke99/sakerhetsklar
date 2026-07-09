"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app_page_error", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md rounded-xl border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Något gick fel</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sidan kunde inte visas just nu. Försök igen — kvarstår problemet,
          kontakta er administratör eller support.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Referens: {error.digest}
          </p>
        ) : null}
        <Button className="mt-4" onClick={() => reset()}>
          Försök igen
        </Button>
      </div>
    </main>
  );
}
