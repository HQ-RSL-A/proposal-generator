import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* Layout skeleton for the dashboard: KPI strip + proposals table in their real
   proportions, so the loaded page lands without a reflow. Other admin routes keep
   the group-level spinner. */
export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading proposals" className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-7 w-32" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-2">
        <Card size="lg" className="col-span-2 lg:row-span-2">
          <CardContent className="flex flex-1 flex-col">
            <div className="flex items-start justify-between">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-8 w-8" />
            </div>
            <Skeleton className="mt-4 h-11 w-44" />
            <Skeleton className="mt-4 h-6 w-36 rounded-full" />
            <div className="min-h-16 flex-1" />
            <div className="border-t border-border-subtle pt-4">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="mt-2 h-7 w-28" />
            </div>
          </CardContent>
        </Card>
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} size="lg">
            <CardContent className="flex flex-1 flex-col">
              <div className="flex items-start justify-between">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-7 w-7" />
              </div>
              <Skeleton className="mt-4 h-8 w-20" />
              <Skeleton className="mt-4 h-3.5 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-10 w-80 rounded-xl" />
        <Skeleton className="h-4 w-20" />
      </div>

      <Card size="lg" className="py-0">
        <div className="flex gap-3 border-b border-border-subtle bg-surface-raised px-(--card-spacing) py-3.5">
          <Skeleton className="h-3 w-[26%]" />
          <Skeleton className="h-3 w-[22%]" />
          <Skeleton className="h-3 w-[16%]" />
          <Skeleton className="h-3 w-[17%]" />
          <Skeleton className="ml-auto h-3 w-[9%]" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border-subtle px-(--card-spacing) py-4 last:border-0"
          >
            <Skeleton className="h-4 w-[26%]" />
            <Skeleton className="h-4 w-[22%]" />
            <Skeleton className="h-4 w-[16%]" />
            <Skeleton className="h-5 w-[17%] rounded-full" />
            <Skeleton className="ml-auto h-4 w-[9%]" />
          </div>
        ))}
      </Card>
    </div>
  );
}
