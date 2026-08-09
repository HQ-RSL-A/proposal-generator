"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { GoogleG } from "@/components/googleG";

/** Client island for the sign-in form: shows the OAuth redirect as a pending state
    (the Google G hides while the spinner runs — Button's data-loading rule). */
export function SignInButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="lg"
      variant="outline"
      loading={pending}
      className="cta-lift h-12 w-full gap-2.5 rounded-xl border-border bg-white text-base font-semibold text-foreground shadow-md hover:bg-white hover:shadow-lg"
    >
      <GoogleG className="size-4.5" />
      Continue with Google
    </Button>
  );
}
