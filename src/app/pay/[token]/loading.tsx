import Image from "next/image";
import { Spinner } from "@/components/ui/spinner";

// The pay route blocks on a live Stripe call before redirecting to Checkout — this is
// the only feedback the payer gets in between.
export default function PayLoading() {
  return (
    <div
      role="status"
      aria-label="Opening secure checkout"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-4"
    >
      <Image src="/logomark.png" alt="RSL/A" width={36} height={36} className="rounded-lg" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Opening secure checkout
      </div>
    </div>
  );
}
