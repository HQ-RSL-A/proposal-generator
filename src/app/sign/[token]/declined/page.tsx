import { OutcomeCard } from "@/components/signing/outcomeCard";

export default function DeclinedPage() {
  return (
    <OutcomeCard icon="✉️" title="Proposal declined">
      <p>
        No hard feelings. Rahul has been notified. If anything changes or you&apos;d like to
        discuss a different scope, just reply to the original email.
      </p>
    </OutcomeCard>
  );
}
