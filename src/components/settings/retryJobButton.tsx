"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { retryJob } from "@/actions/proposals";
import { brandToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function RetryJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const result = await retryJob(jobId);
      if (result.ok) {
        brandToast(
          "success",
          "Retry queued",
          "The job is running again — it leaves this list once it succeeds."
        );
        router.refresh();
      } else {
        brandToast("error", "Retry didn't start", result.error);
      }
    } catch {
      brandToast("error", "Retry didn't start", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="secondary" disabled={busy} onClick={run}>
      {busy ? <Spinner /> : null}
      {busy ? "Retrying…" : "Retry"}
    </Button>
  );
}
