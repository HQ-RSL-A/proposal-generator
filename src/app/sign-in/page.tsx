import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user?.email?.endsWith("@rsla.io")) redirect("/dashboard");

  return (
    <div className="flex min-h-screen">
      {/* Left: dark brand panel (desktop only) */}
      <div className="relative hidden w-2/5 flex-col items-center justify-center overflow-hidden bg-foreground p-12 md:flex">
        <div className="pointer-events-none absolute -top-1/3 left-1/2 h-112 w-md -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />
        <div className="relative flex flex-col items-center text-center">
          <Image src="/logomark.png" alt="RSL/A" width={56} height={56} className="rounded-xl" />
          <p className="font-heading mt-6 text-lg font-semibold text-white">RSL/A Proposals</p>
          <p className="mt-1 text-sm text-white/60">Send it. They sign. You get paid.</p>
        </div>
      </div>

      {/* Right: sign-in (the only panel on mobile) */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <Image
            src="/logomark.png"
            alt="RSL/A"
            width={44}
            height={44}
            className="mx-auto rounded-lg md:hidden"
          />
          <p className="mt-4 text-sm text-muted-foreground md:mt-0">
            RSL/A team. Sign in with your rsla.io Google account.
          </p>
          <form
            className="mt-6"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <Button type="submit" size="lg" className="w-full">
              Continue with Google
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            Protected by Google SSO, rsla.io accounts only.
          </p>
        </div>
      </div>
    </div>
  );
}
