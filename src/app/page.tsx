import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CreditCard, FileSignature, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const points = [
  {
    icon: FileSignature,
    title: "One link covers everything",
    text: "The proposal, the agreement, and the signature live on a single page. No attachments, no printing, no back and forth.",
  },
  {
    icon: CreditCard,
    title: "Signed means paid",
    text: "The moment the last signature lands, checkout opens. Card or bank transfer, handled by Stripe.",
  },
  {
    icon: ShieldCheck,
    title: "Every step on the record",
    text: "Views, signatures, consent, and payment are timestamped and hashed. The executed PDF comes with its own signature certificate.",
  },
];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.email?.endsWith("@rsla.io")) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Image src="/logomark.svg" alt="RSL/A" width={24} height={24} />
          <span className="font-heading text-sm font-bold tracking-tight">RSL/A Proposals</span>
        </div>
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/sign-in" />}>
          Sign in
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 pb-20">
        <div className="max-w-2xl">
          <p className="font-tag text-xs uppercase tracking-widest text-primary">
            Internal tool · RSL/A LLC
          </p>
          <h1 className="font-heading mt-4 text-4xl font-black leading-tight sm:text-5xl">
            Send it. They sign.
            <br />
            You get paid.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            This is where RSL/A proposals live. A client gets one link, reads everything, signs in
            the browser, and lands straight in checkout. That&apos;s it.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Button size="lg" nativeButton={false} render={<Link href="/sign-in" />}>
              Sign in with Google
            </Button>
            <span className="text-xs text-muted-foreground">rsla.io accounts only</span>
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {points.map((point) => (
            <div key={point.title} className="card-hover rounded-xl border border-border bg-white p-5">
              <point.icon className="h-5 w-5 text-primary" />
              <p className="font-heading mt-3 text-sm font-bold">{point.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{point.text}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-4xl px-6 pb-6">
        <p className="text-xs text-muted-foreground">
          RSL/A LLC · New York ·{" "}
          <a href="https://rsla.io" className="underline hover:text-foreground">
            rsla.io
          </a>
        </p>
      </footer>
    </div>
  );
}
