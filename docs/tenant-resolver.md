# Tenant resolver

`src/lib/tenant-resolver/` maps an incoming Host header to safe tenant
configuration. It fails closed.

## Flow

1. `normalizeHost` sanitizes the Host header: lowercase, strips a numeric port,
   rejects anything with schemes, paths, credentials, whitespace or malformed
   labels (spoofing protection).
2. Primary app hosts (`APP_PRIMARY_HOSTS`) resolve to the shared Model A data
   plane.
3. Other hosts are looked up in `tenant_domains` (control plane), joined with
   tenant status, enabled modules, auth provider and data-plane connection.
4. `resolveFromRegistry` (pure, fully tested) decides:
   - unknown domain → `unknown_domain` (fail closed)
   - disabled/pending domain → refused
   - paused/disabled tenant → refused
   - Model A → shared Supabase URL + publishable key
   - Model B/C → the tenant's isolated data plane; refused if the connection is
     missing, inactive or environment-mismatched
5. The result contains **only safe values**: tenant id, environment, deployment
   model, enabled modules, auth provider type, Supabase URL, publishable key,
   API base URL. Never service keys or secret references.

## Caching

A small TTL cache stores safe registry rows only. Domain registration clears
the cache.

## Endpoint

`GET /api/v1/control-plane/resolve` returns the safe config for the current
host and 404 for unknown domains without enumeration detail.

## Domain conventions

- Model A: `app.sakerhetsklar.se`
- Model B: `<kund>.sakerhetsklar.se`
- Model C: customer-owned domains (`nis2.<kommun>.se`, `compliance.<kund>.se`)

Avoid domains that could imply Säkerhetsklar is an official authority portal.

## Tests

`src/lib/tenant-resolver/resolve.test.ts` covers unknown domains, spoofing,
cross-tenant leakage, environment mismatch, disabled/paused tenants, inactive
or missing data planes, missing auth providers, Model B/C routing and a
no-secrets assertion on the resolved config.
