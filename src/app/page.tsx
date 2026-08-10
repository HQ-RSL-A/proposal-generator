import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { GoogleG } from "@/components/googleG";
import { Reveal } from "@/components/landing/reveal";
import { AppPreview } from "@/components/landing/appPreview";
import { CreditCard, FileSignature, PenLine } from "lucide-react";

export const dynamic = "force-dynamic";

const steps = [
  {
    n: "01",
    icon: FileSignature,
    title: "Send it",
    text: "One link holds the proposal, the agreement, and the signature. No attachments, no printing, no back and forth.",
  },
  {
    n: "02",
    icon: PenLine,
    title: "They sign",
    text: "The client reads it, picks a plan, and signs in the browser. Drawn or typed, with consent on the record, on any device.",
  },
  {
    n: "03",
    icon: CreditCard,
    title: "You get paid",
    text: "The last signature opens checkout. Card or bank transfer through Stripe, then an executed PDF lands in every inbox.",
  },
];

const trust = ["ESIGN consent", "SHA-256 hashed", "Signature certificate", "Stripe payments"];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.email?.endsWith("@rsla.io")) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-surface">
      {/* Backdrop: faded dot grid + spotlight wash */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="dot-pattern absolute inset-0 opacity-60 mask-[radial-gradient(ellipse_60%_45%_at_50%_0%,black,transparent)]" />
        <div className="absolute top-[-12%] left-1/2 h-150 w-225 -translate-x-1/2 rounded-full bg-primary/15 blur-[130px]" />
        <div className="absolute right-[4%] top-[8%] h-100 w-100 rounded-full bg-(--chart-2)/12 blur-[110px]" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Image src="/logomark.png" alt="RSL/A" width={30} height={30} className="rounded-md" priority />
        <Button
          size="sm"
          variant="secondary"
          nativeButton={false}
          render={<Link href="/sign-in" />}
          className="rounded-lg"
        >
          Sign in
        </Button>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24">
        {/* Hero */}
        <section className="mx-auto max-w-3xl pt-20 text-center sm:pt-28">
          <Reveal immediate>
            <h1 className="font-heading text-[clamp(2.75rem,6.5vw,5rem)] font-black leading-[1.02] tracking-tight text-balance text-foreground">
              Send it. They sign.
              <br />
              <span className="text-primary">You get paid.</span>
            </h1>
          </Reveal>

          <Reveal immediate delay={0.08}>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
              Every RSL/A proposal lives here. A client gets one link, reads everything, signs in
              the browser, and lands straight in checkout. That&apos;s it.
            </p>
          </Reveal>

          <Reveal immediate delay={0.16}>
            <div className="mt-9 flex flex-col items-center gap-2.5">
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link href="/sign-in" />}
                className="cta-lift h-12 gap-2.5 rounded-xl border-border bg-card px-6 text-base font-semibold text-foreground shadow-md hover:bg-card hover:shadow-lg"
              >
                <GoogleG className="size-4.5" />
                Sign in with Google
              </Button>
              <span className="text-xs text-muted-foreground">rsla.io accounts only</span>
            </div>
          </Reveal>
        </section>

        {/* Product centerpiece */}
        <div className="mt-16 sm:mt-20">
          <AppPreview />
        </div>

        {/* Trust strip */}
        <Reveal className="mt-12" delay={0.05}>
          <div className="font-tag flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            {trust.map((item, i) => (
              <span key={item} className="flex items-center gap-x-5">
                {i > 0 ? <span className="h-1 w-1 rounded-full bg-border" /> : null}
                {item}
              </span>
            ))}
          </div>
        </Reveal>

        {/* How it works */}
        <section className="mx-auto mt-28 max-w-5xl sm:mt-36">
          <Reveal className="text-center">
            <span className="font-tag text-xs uppercase tracking-[0.18em] text-primary">
              How it works
            </span>
            <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              From sent to paid, on one link.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {steps.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.08}>
                <div className="card-hover h-full rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary ring-1 ring-primary/10">
                      <step.icon className="size-5" />
                    </span>
                    <span className="font-tag text-sm tabular-nums text-muted-foreground/70">
                      {step.n}
                    </span>
                  </div>
                  <h3 className="font-heading mt-5 text-lg font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                    {step.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl border-t border-border/60 px-6 py-6">
        <p className="text-xs text-muted-foreground">
          RSL/A LLC · New York ·{" "}
          <a href="https://rsla.io" className="underline-offset-2 hover:text-foreground hover:underline">
            rsla.io
          </a>{" "}
          ·{" "}
          <a href="mailto:team@rsla.io" className="underline-offset-2 hover:text-foreground hover:underline">
            team@rsla.io
          </a>
        </p>
      </footer>
    </div>
  );
}
