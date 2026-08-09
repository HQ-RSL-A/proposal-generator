import { Spinner } from "@/components/ui/spinner";

// Renders inside AppShell while an admin page's server render is in flight.
export default function AdminLoading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex min-h-[50vh] items-center justify-center"
    >
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  );
}
