"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ORGANIZATION_TYPES = [
  ["private_company", "Private company"],
  ["municipality", "Municipality"],
  ["region", "Region"],
  ["municipal_company", "Municipal company"],
  ["state_agency", "State agency"],
  ["other_public_body", "Other public body"],
  ["non_profit", "Non-profit"],
  ["other", "Other"],
] as const;

export function CreateTenantForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [orgType, setOrgType] = useState<string>("private_company");
  const [plan, setPlan] = useState("starter");
  const [contactEmail, setContactEmail] = useState("");

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Create tenant
      </Button>
    );
  }

  return (
    <form
      className="mb-6 grid gap-3 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/v1/tenants", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              slug,
              plan,
              organizationType: orgType,
              ...(orgNumber ? { organizationNumber: orgNumber } : {}),
              ...(contactEmail ? { primaryContactEmail: contactEmail } : {}),
            }),
          });
          const json = (await res.json().catch(() => ({}))) as {
            error?: { message?: string };
          };
          if (!res.ok) {
            setError(json.error?.message ?? "Could not create tenant.");
            return;
          }
          setOpen(false);
          setName("");
          setSlug("");
          setOrgNumber("");
          setContactEmail("");
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="tenant-name">Name</Label>
        <Input
          id="tenant-name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slug) {
              setSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "")
                  .slice(0, 63),
              );
            }
          }}
          placeholder="Organisation AB"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-slug">Slug</Label>
        <Input
          id="tenant-slug"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="organisation-ab"
          pattern="[a-z0-9][a-z0-9-]*"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-orgnr">Organization number</Label>
        <Input
          id="tenant-orgnr"
          value={orgNumber}
          onChange={(e) => setOrgNumber(e.target.value)}
          placeholder="556000-0000"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-orgtype">Organization type</Label>
        <select
          id="tenant-orgtype"
          value={orgType}
          onChange={(e) => setOrgType(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {ORGANIZATION_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-plan">Plan</Label>
        <select
          id="tenant-plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="starter">Starter</option>
          <option value="business">Business</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-contact">Primary contact email</Label>
        <Input
          id="tenant-contact"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="kontakt@organisation.se"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-3">
          {error}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={busy || !name || !slug}>
          {busy ? "Creating…" : "Create"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
