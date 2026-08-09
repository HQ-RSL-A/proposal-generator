"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { OutcomeCard } from "@/components/signing/outcomeCard";
import { Button } from "@/components/ui/button";

export default function SigningError({
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
    <OutcomeCard icon={TriangleAlert} tone="error" title="Something went wrong on our end">
      <p>
        Your document is safe and nothing you did was lost. Reload to pick up where you
        left off.
      </p>
      <div className="pt-3">
        <Button onClick={reset}>Reload the document</Button>
      </div>
    </OutcomeCard>
  );
}
