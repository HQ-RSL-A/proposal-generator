import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/dates";
import { retryJob } from "@/actions/proposals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * The system panel inside Settings (admin-only). Anything that appears here
 * also reached the admin inbox as a [System alert] email the moment it broke.
 */
export async function SystemHealthPanel() {
  const [deadJobs, pendingJobs, stuckPayments, bounces, cronLogs] = await Promise.all([
    prisma.pendingJob.findMany({
      where: { status: "DEAD" },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { proposal: { select: { title: true } } },
    }),
    prisma.pendingJob.count({ where: { status: "PENDING" } }),
    prisma.proposal.findMany({
      where: {
        status: "SIGNED",
        paymentStatus: { in: ["AWAITING", "PROCESSING", "SESSION_EXPIRED", "FAILED"] },
      },
      orderBy: { completedAt: "asc" },
      take: 20,
    }),
    prisma.emailLog.findMany({
      // eslint-disable-next-line react-hooks/purity -- request-time cutoff for a server component query
      where: { status: { in: ["BOUNCED", "FAILED"] }, sentAt: { gt: new Date(Date.now() - 7 * 86_400_000) } },
      orderBy: { sentAt: "desc" },
      take: 20,
      include: { proposal: { select: { title: true } } },
    }),
    prisma.cronLog.findMany({ orderBy: { ranAt: "desc" }, take: 12 }),
  ]);

  const lastCronByPath = new Map<string, (typeof cronLogs)[number]>();
  for (const log of cronLogs) {
    if (!lastCronByPath.has(log.path)) lastCronByPath.set(log.path, log);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="font-tag text-xs uppercase tracking-wide text-muted-foreground">
              Dead jobs
            </p>
            <p className="font-heading mt-1 text-2xl font-bold">{deadJobs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="font-tag text-xs uppercase tracking-wide text-muted-foreground">
              Queued jobs
            </p>
            <p className="font-heading mt-1 text-2xl font-bold">{pendingJobs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="font-tag text-xs uppercase tracking-wide text-muted-foreground">
              Signed, unpaid
            </p>
            <p className="font-heading mt-1 text-2xl font-bold">{stuckPayments.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Failed background tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {deadJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">All clear.</p>
          ) : (
            <div className="space-y-2">
              {deadJobs.map((job) => (
                <form
                  key={job.id}
                  action={async () => {
                    "use server";
                    await retryJob(job.id);
                  }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {job.jobType}
                      {job.proposal ? ` · ${job.proposal.title}` : ""}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {job.attempts} attempts · {job.lastError?.slice(0, 140) ?? "unknown error"}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" type="submit">
                    Retry
                  </Button>
                </form>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signed but unpaid</CardTitle>
        </CardHeader>
        <CardContent>
          {stuckPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing outstanding.</p>
          ) : (
            <div className="space-y-2">
              {stuckPayments.map((proposal) => (
                <Link
                  key={proposal.id}
                  href={`/proposals/${proposal.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:border-primary/50"
                >
                  <div>
                    <p className="font-medium">{proposal.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Signed {proposal.completedAt ? formatDateTime(proposal.completedAt) : "—"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="border-0 bg-amber-100 text-amber-700">
                    {proposal.paymentStatus}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email issues (7 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {bounces.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bounces or failures.</p>
          ) : (
            <div className="space-y-2">
              {bounces.map((log) => (
                <div key={log.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium wrap-break-word">
                    {log.templateId} → {log.recipient}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {log.status} · {formatDateTime(log.sentAt)} · {log.proposal.title}
                    {log.error ? ` · ${log.error.slice(0, 80)}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cron runs</CardTitle>
        </CardHeader>
        <CardContent>
          {lastCronByPath.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cron runs recorded yet (they start once deployed to Vercel).
            </p>
          ) : (
            <div className="space-y-2 text-sm">
              {[...lastCronByPath.values()].map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{log.path}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(log.ranAt)} · {log.durationMs}ms{log.note ? ` · ${log.note}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      log.ok
                        ? "border-0 bg-emerald-100 text-emerald-700"
                        : "border-0 bg-rose-100 text-rose-700"
                    }
                  >
                    {log.ok ? "ok" : "failed"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
