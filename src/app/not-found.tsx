import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { OutcomeCard } from "@/components/signing/outcomeCard";

export default function NotFound() {
  return (
    <OutcomeCard icon={FileQuestion} tone="neutral" title="This page doesn't exist">
      <p>
        The link may be out of date. If you followed a link from an email, open the most
        recent email we sent you and use the button there.
      </p>
      <p className="pt-2">
        <Link href="/" className="font-medium text-primary underline underline-offset-4">
          Go to the homepage
        </Link>
      </p>
    </OutcomeCard>
  );
}
