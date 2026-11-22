export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Юкланмоқда">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--line)]" />
      <div className="card h-28 animate-pulse" />
      <div className="card h-96 animate-pulse" />
    </div>
  );
}
