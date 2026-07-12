import { Skeleton } from "@/components/ui/Skeleton";

export function AdminTableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <>
      {/* Mobile card skeletons */}
      <div className="space-y-3 md:hidden" aria-hidden>
        {Array.from({ length: Math.min(rows, 4) }).map((_, r) => (
          <div
            key={r}
            className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-card"
          >
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>

      {/* Desktop table skeleton */}
      <div
        className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card md:block"
        aria-hidden
      >
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-24" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-50 p-4">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex items-center gap-4 py-3">
              {Array.from({ length: cols }).map((_, c) => (
                <Skeleton
                  key={c}
                  className={c === 0 ? "h-8 w-8 rounded-full" : "h-4 flex-1"}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function AdminCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-6"
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5"
        >
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-xl" />
          </div>
          <Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

export function AdminChartSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-52 w-full rounded-xl sm:h-56" />
        </div>
      ))}
    </div>
  );
}
