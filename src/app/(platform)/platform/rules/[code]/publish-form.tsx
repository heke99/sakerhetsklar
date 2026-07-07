"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PublishForm({
  code,
  currentVersion,
  impactedCount,
}: {
  code: string;
  currentVersion: string;
  impactedCount: number;
}) {
  const router = useRouter();
  const [version, setVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/rules/${code}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, changelog }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Publishing failed");
        return;
      }
      setVersion("");
      setChangelog("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-lg space-y-4 rounded-xl border bg-card p-5"
    >
      <p className="text-sm text-muted-foreground">
        Current version: <span className="font-mono">{currentVersion}</span>.
        Publishing affects <strong>{impactedCount}</strong> tenant(s).
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="version">New version (semver)</Label>
        <Input
          id="version"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="1.1.0"
          required
          pattern="\d+\.\d+\.\d+"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="changelog">Changelog</Label>
        <Textarea
          id="changelog"
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder="What changed and why"
          required
          rows={3}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Publishing…" : "Publish version"}
      </Button>
    </form>
  );
}
