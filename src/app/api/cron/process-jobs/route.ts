import { NextResponse, type NextRequest } from "next/server";
import { processDueJobs } from "@/lib/jobRunner";
import { isAuthorizedCron, logCronRun } from "@/lib/cronAuth";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  try {
    const result = await processDueJobs(10);
    await logCronRun("/api/cron/process-jobs", started, true, `ran=${result.ran} failed=${result.failed}`);
    return NextResponse.json(result);
  } catch (error) {
    await logCronRun("/api/cron/process-jobs", started, false, String(error).slice(0, 300));
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
