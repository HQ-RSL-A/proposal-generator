import { OutcomeCard } from "@/components/signing/outcomeCard";
import { MailX } from "lucide-react";

export default function DeclinedPage() {
  return (
    <OutcomeCard icon={MailX} tone="neutral" title="Proposal declined">
      <p>
        No hard feelings. Our team has been notified. If anything changes or you&apos;d like to
        talk through a different scope, just reply to the original email.
      </p>
    </OutcomeCard>
  );
}
