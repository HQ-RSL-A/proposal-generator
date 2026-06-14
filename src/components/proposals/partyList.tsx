"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFreshSigningLink, remindParty } from "@/actions/proposals";
import { BellRing, Check, Link2 } from "lucide-react";

export interface PartyRow {
  id: string;
  role: "ADMIN_SIGNER" | "CLIENT_SIGNER";
  name: string;
  email: string;
  payer: boolean;
  signedAtLabel: string | null;
  declined: boolean;
  emailBounced: boolean;
  lastEmailStatus: string | null;
}

export function PartyList({
  parties,
  proposalOpen,
}: {
  parties: PartyRow[];
  proposalOpen: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-white">
      {parties.map((party) => (
        <div key={party.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{party.name}</p>
              {party.role === "ADMIN_SIGNER" ? (
                <Badge variant="secondary" className="border-0 bg-muted text-muted-foreground">
                  RSL/A
                </Badge>
              ) : null}
              {party.payer ? (
                <Badge variant="secondary" className="border-0 bg-accent text-accent-foreground">
                  Payer
                </Badge>
              ) : null}
              {party.emailBounced ? (
                <Badge variant="secondary" className="border-0 bg-rose-100 text-rose-700">
                  Email bounced
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {party.email}
              {party.lastEmailStatus ? ` · last email: ${party.lastEmailStatus.toLowerCase()}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {party.signedAtLabel ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-success">
                <Check className="h-4 w-4" /> {party.signedAtLabel}
              </span>
            ) : party.declined ? (
              <span className="text-sm font-medium text-destructive">Declined</span>
            ) : party.role === "CLIENT_SIGNER" && proposalOpen ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === party.id}
                  onClick={async () => {
                    setBusyId(party.id);
                    try {
                      const result = await getFreshSigningLink(party.id);
                      if (!result.ok) return void toast.error(result.error);
                      await navigator.clipboard.writeText(result.data!.url);
                      toast.success("Fresh link copied. Earlier emailed links are now invalid.");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  <Link2 className="h-3.5 w-3.5" /> Copy link
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyId === party.id}
                  onClick={async () => {
                    setBusyId(party.id);
                    try {
                      const result = await remindParty(party.id);
                      if (!result.ok) return void toast.error(result.error);
                      toast.success("Reminder sent", {
                        description:
                          "It carries a fresh signing link, so links in earlier emails no longer work.",
                      });
                      router.refresh();
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  <BellRing className="h-3.5 w-3.5" /> Remind
                </Button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
