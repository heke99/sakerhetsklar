export default function Loading() {
  return (
    <main className="p-8" aria-busy="true">
      <div className="mb-6 h-8 w-64 animate-pulse rounded-md bg-muted" />
      <div className="mb-8 h-4 w-96 animate-pulse rounded-md bg-muted" />
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
      <p className="sr-only">Laddar…</p>
    </main>
  );
}
