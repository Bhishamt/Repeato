export default function RootLoading() {
  return (
    <div className="min-h-dvh bg-paper">
      <div className="border-b border-line bg-white">
        <div className="wrap flex h-16 items-center">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-paper-deep" />
        </div>
      </div>
      <div className="wrap py-10">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-paper-deep" />
        <div className="mt-4 h-4 w-80 animate-pulse rounded bg-paper-deep" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-line bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}

