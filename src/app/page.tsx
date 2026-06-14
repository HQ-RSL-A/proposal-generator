import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Check, CreditCard, FileSignature, ShieldCheck } from "lucide-react";

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

/** A div-built snapshot of the signing experience, framed like a browser window. */
function AppSnapshot() {
  const tiers = [
    { name: "Foundation", price: "$1,800/mo" },
    { name: "Growth", price: "$3,000/mo", recommended: true },
    { name: "Premier", price: "$4,500/mo" },
  ];
  return (
    <div className="relative">
      {/* Glow behind the window */}
      <div className="pointer-events-none absolute inset-x-0 -top-12 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-primary/20 blur-3xl" />

      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_3px_rgba(17,24,39,0.06),0_40px_80px_-32px_rgba(17,24,39,0.35)]">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400/70" />
          <span className="h-3 w-3 rounded-full bg-amber-400/70" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
          <div className="ml-2 flex flex-1 justify-center">
            <span className="rounded-md bg-white px-3 py-1 text-[11px] text-muted-foreground ring-1 ring-border">
              proposals.rsla.io/sign
            </span>
          </div>
        </div>

        {/* Mock signing document */}
        <div className="p-5 text-left sm:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/logomark.png" alt="" width={24} height={24} className="rounded" />
              <span className="font-heading text-sm font-bold">Growth Marketing System</span>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              Signed
            </span>
          </div>

          <div className="mt-5 space-y-2">
            <div className="h-2.5 w-1/2 rounded bg-muted" />
            <div className="h-2 w-full rounded bg-muted" />
            <div className="h-2 w-5/6 rounded bg-muted" />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={
                  "relative rounded-lg border p-2.5 sm:p-3 " +
                  (tier.recommended
                    ? "border-primary bg-accent/60"
                    : "border-border bg-white")
                }
              >
                {tier.recommended ? (
                  <span className="font-tag absolute -top-2 left-2 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white">
                    Recommended
                  </span>
                ) : null}
                <p className="text-[11px] font-semibold sm:text-xs">{tier.name}</p>
                <p className="mt-0.5 text-[11px] font-bold tabular-nums sm:text-sm">{tier.price}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-end justify-between gap-4">
            <div className="min-w-0 flex-1 rounded-lg border border-dashed border-primary/40 bg-accent/40 p-3">
              <p className="font-tag text-[9px] uppercase tracking-wide text-muted-foreground">
                Signature
              </p>
              <p className="font-[cursive] text-lg leading-tight text-foreground">
                Dominique Norris
              </p>
              <p className="text-[10px] text-muted-foreground">Owner, Brightline</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-muted-foreground">Paid in full</span>
              <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                $3,000 paid
              </span>
            </div>
          </div>
        </div>
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
        <div className="absolute -top-40 left-1/2 h-160 w-160 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/4 -right-20 h-120 w-120 rounded-full bg-[#00C2FF]/10 blur-3xl" />
      </div>

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Image src="/logomark.png" alt="RSL/A" width={30} height={30} className="rounded-md" />
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/sign-in" />}>
          Sign in
        </Button>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-20 pt-10 sm:pt-16">
        {/* Centered hero */}
        <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto max-w-2xl text-center duration-700">
          <span className="font-tag inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
            <Check className="h-3 w-3 text-primary" />
            Internal tool · RSL/A LLC
          </span>
          <h1 className="font-heading mt-5 text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl">
            Send it. They sign.
            <br />
            <span className="gradient-text">You get paid.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Every RSL/A proposal lives here. A client gets one link, reads everything, signs in
            the browser, and lands straight in checkout. That&apos;s it.
          </p>
          <div className="mt-8 flex flex-col items-center gap-2">
            <Button size="lg" nativeButton={false} render={<Link href="/sign-in" />}>
              Sign in with Google
            </Button>
            <span className="text-xs text-muted-foreground">rsla.io accounts only</span>
          </div>
        </div>

        {/* Snapshot mockup */}
        <div className="animate-in fade-in slide-in-from-bottom-6 mt-16 delay-150 duration-700">
          <AppSnapshot />
        </div>

        {/* Feature cards */}
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
