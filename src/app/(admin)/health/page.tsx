import { redirect } from "next/navigation";

/** Health moved into Settings → System. Old links and bookmarks land there. */
export default function HealthPage() {
  redirect("/settings?tab=system");
}
