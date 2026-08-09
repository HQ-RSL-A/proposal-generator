import Image from "next/image";
import { Spinner } from "@/components/ui/spinner";

// Covers /sign/[token] and its outcome subroutes while the server render is in flight.
export default function SigningLoading() {
  return (
    <div
      role="status"
      aria-label="Preparing your document"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-4"
    >
      <Image src="/logomark.png" alt="RSL/A" width={36} height={36} className="rounded-lg" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Preparing your document
      </div>
    </div>
  );
}
