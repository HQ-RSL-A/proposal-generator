import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { SignInButton } from "@/components/signInButton";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user?.email?.endsWith("@rsla.io")) redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-surface p-3 lg:p-4">
      {/* Left: sign-in */}
      <main className="flex flex-1 flex-col px-6 py-8 sm:px-12">
        <Image src="/logomark.png" alt="RSL/A" width={36} height={36} className="rounded-lg" priority />

        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Welcome
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Sign in to RSL/A Proposals and pick up where you left off.
            </p>

            <form
              className="mt-8"
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/dashboard" });
              }}
            >
              <SignInButton />
            </form>

            <p className="mt-5 text-xs text-muted-foreground">
              Protected by Google SSO. rsla.io accounts only.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">RSL/A LLC · New York</p>
      </main>

      {/* Right: abstract art panel (desktop only) */}
      <div className="relative hidden w-[42%] overflow-hidden rounded-3xl ring-1 ring-foreground/10 lg:block">
        <Image src="/signinArt.png" alt="" fill priority sizes="42vw" className="object-cover" />
      </div>
    </div>
  );
}
