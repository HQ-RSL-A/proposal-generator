"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Renders inside AppShell (nav stays usable) when an admin page throws.
export default function AdminError({
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
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="w-full max-w-md rounded-xl bg-card p-6 text-center ring-1 ring-foreground/10">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-destructive-subtle text-destructive">
          <TriangleAlert className="h-5 w-5" />
        </div>
        <h1 className="font-heading mt-3 text-lg font-bold">This page hit an error</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The rest of the app is fine. Try again, or check Settings &rarr; System if it
          keeps happening.
        </p>
        <div className="mt-4">
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
