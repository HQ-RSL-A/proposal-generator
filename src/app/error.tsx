"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { OutcomeCard } from "@/components/signing/outcomeCard";
import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <OutcomeCard icon={TriangleAlert} tone="error" title="Something went wrong">
      <p>
        An unexpected error stopped this page from loading. Nothing you entered has been
        lost.
      </p>
      <div className="pt-3">
        <Button onClick={reset}>Try again</Button>
      </div>
    </OutcomeCard>
  );
}
