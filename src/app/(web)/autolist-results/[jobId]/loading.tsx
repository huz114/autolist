export default function AutolistResultsLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Back link skeleton */}
      <div className="mb-6">
        <div className="h-4 w-32 bg-[rgba(255,255,255,0.04)] rounded animate-pulse mb-4" />
        <div className="h-7 w-28 bg-[rgba(255,255,255,0.04)] rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-48 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
      </div>

      {/* Job info banner skeleton */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-xl px-5 py-4 mb-6 flex flex-wrap gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i}>
            <div className="h-3 w-14 bg-[rgba(255,255,255,0.04)] rounded animate-pulse mb-1.5" />
            <div className="h-5 w-20 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Company list skeletons */}
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-xl px-5 py-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3 flex-1">
              <div className="h-4 w-5 bg-[rgba(255,255,255,0.04)] rounded animate-pulse mt-0.5" />
              <div className="space-y-2 flex-1">
                <div className="h-5 w-44 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
                <div className="flex gap-3">
                  <div className="h-3 w-16 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
                  <div className="h-3 w-20 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
                </div>
                <div className="h-3 w-56 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
              </div>
            </div>
            <div className="h-7 w-24 bg-[rgba(255,255,255,0.04)] rounded-lg animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
