"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ProposalSections } from "@/lib/proposalContent";
import type { TierConfig } from "@/lib/types";
import { Check } from "lucide-react";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading mt-12 mb-4 text-xl font-bold text-primary first:mt-0">
      {children}
    </h2>
  );
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
          <span className="mt-0.5 text-primary">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function FinePrint({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

export function TierCards({
  tiers,
  selectedTierId,
  onSelect,
  readOnly,
}: {
  tiers: TierConfig[];
  selectedTierId: string | null;
  onSelect?: (tierId: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-5 grid gap-3",
        tiers.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"
      )}
    >
      {tiers.map((tier) => {
        const selected = tier.id === selectedTierId;
        const highlighted = selected || (!selectedTierId && tier.recommended);
        return (
          <button
            key={tier.id}
            type="button"
            disabled={readOnly}
            onClick={() => onSelect?.(tier.id)}
            className={cn(
              "relative flex flex-col rounded-xl border p-4 text-left transition-all",
              highlighted ? "border-primary bg-accent shadow-sm" : "border-border bg-white",
              !readOnly && "cursor-pointer hover:border-primary/60 hover:shadow-sm",
              readOnly && "cursor-default"
            )}
          >
            {tier.recommended ? (
              <span className="font-tag absolute -top-2.5 left-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Most popular
              </span>
            ) : null}
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "font-heading text-sm font-bold",
                  highlighted ? "text-primary" : "text-foreground"
                )}
              >
                {tier.label}
              </span>
              {selected ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="h-3 w-3" />
                </span>
              ) : null}
            </div>
            <div className="mt-2 space-y-0.5">
              {tier.oneTime ? (
                <p className="text-base font-bold">{tier.oneTime.displayString}</p>
              ) : null}
              {tier.recurring ? (
                <p className="text-base font-bold">{tier.recurring.displayString}</p>
              ) : null}
            </div>
            <ul className="mt-3 space-y-1.5">
              {tier.includes.map((line, i) => (
                <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                  - {line}
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}

export interface SignerSlot {
  name: string;
  detail: string;
  signedAt: string | null;
  signatureImageUrl: string | null;
}

export function ProposalView({
  sections,
  selectedTierId,
  onTierSelect,
  tiersReadOnly,
  clientSlots,
  rslaSlot,
}: {
  sections: ProposalSections;
  selectedTierId: string | null;
  onTierSelect?: (tierId: string) => void;
  tiersReadOnly?: boolean;
  clientSlots: SignerSlot[];
  rslaSlot: SignerSlot;
}) {
  return (
    <article className="document-page mx-auto max-w-3xl rounded-2xl border border-border bg-white px-6 py-10 sm:px-12 sm:py-14">
      {/* Cover */}
      <header className="border-b border-border pb-10">
        <Image src="/logomark.svg" alt="RSL/A" width={36} height={36} />
        <h1 className="font-heading mt-8 text-3xl font-black leading-tight sm:text-4xl">
          {sections.cover.title}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          {sections.cover.subtitle}
        </p>
      </header>

      <div className="document-prose pt-10 text-[15px] leading-relaxed">
        {/* At a Glance */}
        <SectionHeading>At a Glance</SectionHeading>
        <p>{sections.atGlance.intro}</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          {sections.atGlance.rows.map((row, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr]",
                i !== sections.atGlance.rows.length - 1 && "border-b border-border"
              )}
            >
              <div className="bg-surface px-4 py-3 text-sm font-semibold">{row.label}</div>
              <div className="px-4 py-3 text-sm">{row.value}</div>
            </div>
          ))}
        </div>

        {/* Problem */}
        <SectionHeading>{sections.problem.title}</SectionHeading>
        <p>{sections.problem.greeting}</p>
        {sections.problem.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p>{sections.problem.contactLine}</p>
        <p className="mt-4">
          {sections.problem.signOff[0]}
          <br />
          <span className="font-semibold">{sections.problem.signOff[1]}</span>
        </p>

        {/* Solution */}
        <SectionHeading>{sections.solution.title}</SectionHeading>
        <p className="text-muted-foreground">{sections.solution.intro}</p>
        {sections.solution.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p>{sections.solution.outro}</p>

        {/* Track record */}
        <SectionHeading>{sections.trackRecord.heading}</SectionHeading>
        <p>{sections.trackRecord.intro}</p>
        <ul className="mt-3 space-y-2.5">
          {sections.trackRecord.caseStudies.map((cs, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-0.5 text-primary">•</span>
              <a
                href={cs.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-border underline-offset-4 hover:text-primary hover:decoration-primary"
              >
                {cs.text}
              </a>
            </li>
          ))}
        </ul>
        <FinePrint>{sections.trackRecord.disclaimer}</FinePrint>

        {/* Scope */}
        <SectionHeading>{sections.scope.heading}</SectionHeading>
        <p>{sections.scope.intro}</p>
        <div className="mt-3">
          <Bullets items={sections.scope.items} />
        </div>
        <p className="mt-4">{sections.scope.outro}</p>
        <FinePrint>{sections.scope.footnote}</FinePrint>

        {/* Timeline */}
        <SectionHeading>{sections.timeline.heading}</SectionHeading>
        <p>{sections.timeline.intro}</p>
        <div className="mt-3">
          <Bullets items={sections.timeline.items} />
        </div>
        <p className="mt-4">{sections.timeline.outro}</p>
        <FinePrint>{sections.timeline.footnote}</FinePrint>

        {/* Investment */}
        <SectionHeading>{sections.investment.heading}</SectionHeading>
        <p>{sections.investment.note}</p>
        <div className="mt-4 space-y-1">
          {sections.investment.details
            .split("\n")
            .filter((line) => line.trim())
            .map((line, i) => (
              <p key={i} className="font-semibold">
                {line}
              </p>
            ))}
        </div>
        {sections.investment.tiers ? (
          <TierCards
            tiers={sections.investment.tiers}
            selectedTierId={selectedTierId}
            onSelect={onTierSelect}
            readOnly={tiersReadOnly}
          />
        ) : null}
        <FinePrint>{sections.investment.footnote}</FinePrint>

        {/* How to proceed */}
        <SectionHeading>{sections.howToProceed.heading}</SectionHeading>
        <p>{sections.howToProceed.intro}</p>
        <ol className="mt-3 space-y-2.5">
          {sections.howToProceed.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-heading flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        {/* Acceptance */}
        <SectionHeading>{sections.acceptance.heading}</SectionHeading>
        <p>{sections.acceptance.text}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[...clientSlots.map((slot) => ({ ...slot, isClient: true })), { ...rslaSlot, isClient: false }].map(
            (slot, i) => (
              <div key={i} className="rounded-xl border border-border p-4">
                <p className="font-semibold">{slot.name}</p>
                <p className="text-xs text-muted-foreground">{slot.detail}</p>
                <div className="mt-3 flex h-16 items-center border-b border-border">
                  {slot.signatureImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slot.signatureImageUrl}
                      alt={`${slot.name} signature`}
                      className="max-h-14 max-w-[200px] object-contain"
                    />
                  ) : slot.signedAt ? (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-success">
                      <Check className="h-4 w-4" /> Signed
                    </span>
                  ) : (
                    <span className="text-sm italic text-muted-foreground/60">
                      Awaiting signature
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {slot.signedAt ? `Signed ${slot.signedAt}` : "Date: ____________"}
                </p>
              </div>
            )
          )}
        </div>

        {/* MSA */}
        <div className="mt-14 border-t-2 border-foreground pt-10">
          <h1 className="font-heading text-2xl font-black">{sections.msa.heading}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Prepared for <span className="font-semibold text-foreground">{sections.msa.preparedFor}</span>
          </p>
          <div className="mt-6 text-sm leading-relaxed">
            {sections.msa.blocks.map((block, i) => {
              if (block.type === "heading") {
                return (
                  <h3 key={i} className="font-heading mt-7 mb-2.5 text-base font-bold text-primary">
                    {block.text}
                  </h3>
                );
              }
              const runs = block.runs.map((run, j) =>
                run.bold ? (
                  <strong key={j} className="font-semibold">
                    {run.text}
                  </strong>
                ) : (
                  <React.Fragment key={j}>{run.text}</React.Fragment>
                )
              );
              if (block.type === "bullet") {
                return (
                  <div key={i} className="mb-2 flex gap-2.5 pl-1">
                    <span className="text-primary">•</span>
                    <p className="flex-1">{runs}</p>
                  </div>
                );
              }
              return (
                <p key={i} className="mb-3">
                  {runs}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}
