"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { OutcomeCard } from "@/components/signing/outcomeCard";
import { Button } from "@/components/ui/button";

export default function PayError({
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
    <OutcomeCard icon={TriangleAlert} tone="error" title="Checkout didn't open">
      <p>
        Something went wrong before checkout could open. If you already completed a
        payment, you'll receive a receipt by email — nothing is charged twice.
      </p>
      <div className="pt-3">
        <Button onClick={reset}>Try again</Button>
      </div>
    </OutcomeCard>
  );
}
