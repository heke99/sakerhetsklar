"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("platform_page_error", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md rounded-xl border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page could not be rendered. Retry, and check the server logs if
          the problem persists.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}
        <Button className="mt-4" onClick={() => reset()}>
          Retry
        </Button>
      </div>
    </main>
  );
}
