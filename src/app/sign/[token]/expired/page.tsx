import { OutcomeCard } from "@/components/signing/outcomeCard";

export default function ExpiredPage() {
  return (
    <OutcomeCard icon="⌛" title="This proposal has expired">
      <p>
        The signing window has closed. Reach out and we&apos;ll send a refreshed version if the
        engagement is still on the table.
      </p>
    </OutcomeCard>
  );
}
