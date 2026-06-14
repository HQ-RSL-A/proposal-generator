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

/** A div-built mock of a signed, paid proposal. Pure decoration for the hero. */
function MockProposalCard() {
  return (
    <div className="animate-floaty mx-auto w-full max-w-sm rounded-2xl border border-border bg-white p-5 shadow-[0_1px_3px_rgba(17,24,39,0.06),0_30px_60px_-24px_rgba(17,24,39,0.28)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/logomark.png" alt="" width={22} height={22} className="rounded" />
          <span className="text-xs font-semibold">Growth Marketing System</span>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          Signed
        </span>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2 w-3/4 rounded bg-muted" />
        <div className="h-2 w-full rounded bg-muted" />
        <div className="h-2 w-2/3 rounded bg-muted" />
      </div>
      <div className="mt-4 rounded-lg border border-dashed border-primary/40 bg-accent/50 p-3">
        <p className="font-tag text-[10px] uppercase tracking-wide text-muted-foreground">
          Signature
        </p>
        <p className="font-[cursive] text-xl leading-tight text-foreground">Dominique Norris</p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Paid in full</span>
        <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
          $3,000 paid
        </span>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.email?.endsWith("@rsla.io")) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-surface">
      {/* Soft radial glows behind the hero */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/3 h-160 w-160 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 -right-20 h-120 w-120 rounded-full bg-[#00C2FF]/10 blur-3xl" />
      </div>

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Image src="/logomark.png" alt="RSL/A" width={30} height={30} className="rounded-md" />
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/sign-in" />}>
          Sign in
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-20 pt-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Copy */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="font-tag text-xs uppercase tracking-widest text-primary">
              Internal tool · RSL/A LLC
            </p>
            <h1 className="font-heading mt-4 text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl">
              Send it.
              <br />
              They sign.
              <br />
              <span className="gradient-text">You get paid.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Every RSL/A proposal lives here. A client gets one link, reads everything, signs in
              the browser, and lands straight in checkout. That&apos;s it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Button size="lg" nativeButton={false} render={<Link href="/sign-in" />}>
                Sign in with Google
              </Button>
              <span className="text-xs text-muted-foreground">rsla.io accounts only</span>
            </div>
          </div>

          {/* Visual */}
          <div className="animate-in fade-in zoom-in-95 delay-150 duration-700 lg:pl-8">
            <MockProposalCard />
          </div>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {points.map((point) => (
            <div
              key={point.title}
              className="card-hover rounded-xl border border-border bg-white/70 p-5 backdrop-blur-sm"
            >
              <span className="gradient-blue flex h-9 w-9 items-center justify-center rounded-lg text-white">
                <point.icon className="h-4.5 w-4.5" />
              </span>
              <p className="font-heading mt-3.5 text-sm font-bold">{point.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{point.text}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 pb-6">
        <p className="text-xs text-muted-foreground">
          RSL/A LLC · New York ·{" "}
          <a href="https://rsla.io" className="underline hover:text-foreground">
            rsla.io
          </a>{" "}
          ·{" "}
          <a href="mailto:team@rsla.io" className="underline hover:text-foreground">
            team@rsla.io
          </a>
        </p>
      </footer>
    </div>
  );
}
