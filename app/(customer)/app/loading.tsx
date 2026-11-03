export default function CustomerLoading() {
  return (
    <div className="space-y-5">
      <div>
        <div className="h-3 w-16 animate-pulse rounded bg-paper-deep" />
        <div className="mt-2 h-9 w-48 animate-pulse rounded-lg bg-paper-deep" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-paper-deep" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="card card-pad">
            <div className="h-3 w-20 animate-pulse rounded bg-paper-deep" />
            <div className="mt-3 h-8 w-24 animate-pulse rounded bg-paper-deep" />
            <div className="mt-2 h-3 w-36 animate-pulse rounded bg-paper-deep" />
          </div>
        ))}
      </div>
    </div>
  );
}

