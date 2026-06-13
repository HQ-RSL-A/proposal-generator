import { OutcomeCard } from "@/components/signing/outcomeCard";
import { CalendarClock } from "lucide-react";

export default function ExpiredPage() {
  return (
    <OutcomeCard icon={CalendarClock} tone="wait" title="This proposal has expired">
      <p>
        The signing window has closed. Reach out and we&apos;ll send a refreshed version if the
        engagement is still on the table.
      </p>
    </OutcomeCard>
  );
}
