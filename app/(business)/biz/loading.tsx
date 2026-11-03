export default function BusinessLoading() {
  return (
    <div className="space-y-5">
      <div>
        <div className="h-3 w-16 animate-pulse rounded bg-paper-deep" />
        <div className="mt-2 h-9 w-56 animate-pulse rounded-lg bg-paper-deep" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-paper-deep" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="kpi">
            <div className="h-2.5 w-16 animate-pulse rounded bg-paper-deep" />
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-paper-deep" />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="border-b border-line px-5 py-3">
          <div className="h-4 w-32 animate-pulse rounded bg-paper-deep" />
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[#f0e9de] px-5 py-3 last:border-0">
            <div className="h-4 w-24 animate-pulse rounded bg-paper-deep" />
            <div className="h-4 w-40 animate-pulse rounded bg-paper-deep" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-paper-deep" />
          </div>
        ))}
      </div>
    </div>
  );
}

