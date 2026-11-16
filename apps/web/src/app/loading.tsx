export default function Loading() {
  return (
    <div className="container-page py-14">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-100" />
      <div className="mt-3 h-4 w-80 animate-pulse rounded bg-slate-100" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-56 animate-pulse rounded-2xl border border-line bg-slate-50" />
        ))}
      </div>
    </div>
  );
}
