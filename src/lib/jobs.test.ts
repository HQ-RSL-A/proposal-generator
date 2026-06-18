import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");

import { prismaMock } from "@/test/db";
import { reapStuckJobs } from "./jobs";

describe("reapStuckJobs (RSL-13 PROCESSING reaper)", () => {
  it("requeues PROCESSING rows older than the timeout back to PENDING", async () => {
    // A lambda killed mid-batch leaves a job PROCESSING forever; nothing else moves it back.
    prismaMock.pendingJob.updateMany.mockResolvedValue({ count: 2 });

    const requeued = await reapStuckJobs(5 * 60_000);

    expect(requeued).toBe(2);
    expect(prismaMock.pendingJob.updateMany).toHaveBeenCalledOnce();
    const arg = prismaMock.pendingJob.updateMany.mock.calls[0][0] as {
      where: { status: string; processingAt: { lt: Date } };
      data: { status: string };
    };
    expect(arg.where.status).toBe("PROCESSING");
    expect(arg.where.processingAt.lt).toBeInstanceOf(Date);
    expect(arg.data.status).toBe("PENDING");
  });
});
