import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SignInVisual } from "@/components/signInVisual";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user?.email?.endsWith("@rsla.io")) redirect("/dashboard");

  return (
    <div className="flex min-h-screen">
      {/* Left: interactive visual (desktop only) */}
      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-linear-to-br from-surface to-accent p-12 lg:flex">
        <div className="dot-pattern pointer-events-none absolute inset-0 opacity-50" />
        <SignInVisual />
      </div>

      {/* Right: sign-in (the only panel on mobile) */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <Image
            src="/logomark.png"
            alt="RSL/A"
            width={44}
            height={44}
            className="mx-auto rounded-lg"
          />
          <h1 className="font-heading mt-4 text-xl font-bold">RSL/A Proposals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
