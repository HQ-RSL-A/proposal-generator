import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user?.email?.endsWith("@rsla.io")) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface dot-pattern">
      <div className="document-page w-full max-w-sm rounded-2xl border border-border bg-white p-8 text-center">
        <Image src="/logomark.svg" alt="RSL/A" width={40} height={40} className="mx-auto" />
        <h1 className="font-heading mt-4 text-xl font-bold">Proposal Generator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Internal tool — sign in with your rsla.io account.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button type="submit" className="w-full">
            Continue with Google
          </Button>
        </form>
      </div>
    </div>
  );
}
