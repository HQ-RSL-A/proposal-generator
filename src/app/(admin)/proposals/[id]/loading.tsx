import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* Layout skeleton for the proposal detail: header + tab strip + document page,
   so opening a proposal doesn't flash the generic spinner. */
export default function ProposalDetailLoading() {
  return (
    <div role="status" aria-label="Loading proposal" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>

      <Skeleton className="h-8 w-72 rounded-lg" />

      <Card variant="raised" size="lg" className="mx-auto w-full max-w-2xl">
        <CardContent className="space-y-6 py-8">
          <Skeleton className="h-8 w-8" />
          <div className="space-y-2.5">
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-8 w-3/5" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
          </div>
          <div className="space-y-2 pt-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-9/12" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
