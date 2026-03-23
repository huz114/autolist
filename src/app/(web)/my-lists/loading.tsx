export default function MyListsLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header skeleton */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="h-7 w-32 bg-[rgba(255,255,255,0.04)] rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-52 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
        </div>
        <div className="h-10 w-24 bg-[rgba(255,255,255,0.04)] rounded-lg animate-pulse" />
      </div>

      {/* List item skeletons */}
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-5 w-14 bg-[rgba(255,255,255,0.04)] rounded-full animate-pulse" />
                <div className="h-4 w-20 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
              </div>
              <div className="h-5 w-48 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
              <div className="flex gap-4">
                <div className="h-4 w-16 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
                <div className="h-4 w-16 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
                <div className="h-4 w-20 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
              </div>
            </div>
            <div className="h-9 w-28 bg-[rgba(255,255,255,0.04)] rounded-lg animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
