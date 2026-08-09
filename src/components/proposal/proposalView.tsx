"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { discountDisplay, formatCents, formatPricedLine, hasDiscount } from "@/lib/currency";
import type { DepositScheduleInfo, ProposalSections } from "@/lib/proposalContent";
import type { AddOn, FutureItem, OneTimeItem, RecurringItem, TierConfig } from "@/lib/types";
import { Check, PenLine } from "lucide-react";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading mt-9 mb-3 text-xl font-bold text-primary first:mt-0">
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

/** Superscript marker that scrolls to the matching entry in the Notes block. */
function NoteMark({ n }: { n: number }) {
  return (
    <sup className="ml-0.5">
      <a
        href={`#note-${n}`}
        aria-label={`Read note ${n}`}
        className="font-medium text-primary no-underline hover:underline"
      >
        {n}
      </a>
    </sup>
  );
}

/** The struck-through original price + reason, shown under a discounted line. Null when no discount. */
function DiscountNote({
  item,
  intervalMonths,
  align,
}: {
  item: { amountCents: number; discount?: { amountCents: number; reason: string } | null };
  intervalMonths: 1 | 3 | 12 | null;
  align?: "right";
}) {
  const d = discountDisplay(item, intervalMonths);
  if (!d) return null;
  return (
    <span className={cn("block text-xs text-muted-foreground", align === "right" && "text-right")}>
      {/* The strike-through is visual only; give assistive tech the was/now context (RSL-33). */}
      <span className="line-through" aria-label={`Was ${d.originalLabel}, now ${d.netLabel}`}>
        {d.originalLabel}
      </span>{" "}
      <span className="text-primary">{d.reason}</span>
    </span>
  );
}

/**
 * Flat (non-tier) pricing summary. Rendered ONLY when a flat line carries a discount, so the
 * client sees the "was -> now (reason)" breakdown (flat prices otherwise live in the free-text
 * Investment copy). Non-discounted flat proposals render nothing here, unchanged from before.
 */
export function FlatPricing({
  oneTime,
  recurring,
}: {
  oneTime: OneTimeItem | null;
  recurring: RecurringItem | null;
}) {
  const lines: { item: OneTimeItem | RecurringItem; intervalMonths: 1 | 3 | 12 | null }[] = [];
  if (oneTime) lines.push({ item: oneTime, intervalMonths: null });
  if (recurring) lines.push({ item: recurring, intervalMonths: recurring.intervalMonths });
  if (!lines.some((l) => hasDiscount(l.item))) return null;
  return (
    <div className="mt-6">
      <p className="font-tag text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Pricing
      </p>
      <div className="mt-3 space-y-2">
        {lines.map((l, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-3 rounded-xl border border-border bg-white p-3.5"
          >
            <span className="text-sm font-medium">{l.item.label}</span>
            <span className="whitespace-nowrap text-right">
              <span className="block text-sm font-bold">
                {formatPricedLine(l.item.amountCents, l.intervalMonths)}
              </span>
              <DiscountNote item={l.item} intervalMonths={l.intervalMonths} align="right" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
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
      data-tier-anchor
      className={cn(
        "mt-5 grid scroll-mt-24 gap-3",
        tiers.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"
      )}
    >
      {tiers.map((tier) => {
        const selected = tier.id === selectedTierId;
        // Only the actively chosen tier is highlighted. The recommended tier is
        // marked by its badge, not by a pre-selected look.
        const highlighted = selected;
        return (
          <button
            key={tier.id}
            type="button"
            disabled={readOnly}
            onClick={() => onSelect?.(tier.id)}
            className={cn(
              "relative flex flex-col rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              highlighted ? "border-primary bg-accent shadow-sm" : "border-border bg-white",
              !readOnly && "cursor-pointer hover:border-primary/60 hover:shadow-sm active:scale-[0.99]",
              readOnly && "cursor-default"
            )}
          >
            {tier.recommended ? (
              <span className="font-tag absolute -top-2.5 left-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Recommended
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
                <div>
                  <p className="text-base font-bold">{tier.oneTime.displayString}</p>
                  <DiscountNote item={tier.oneTime} intervalMonths={null} />
                </div>
              ) : null}
              {tier.recurring ? (
                <div>
                  <p className="text-base font-bold">{tier.recurring.displayString}</p>
                  <DiscountNote item={tier.recurring} intervalMonths={tier.recurring.intervalMonths} />
                </div>
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

/** Optional add-ons the client can stack on top of the chosen tier or flat price. */
export function AddOnPicker({
  addOns,
  selectedIds,
  onToggle,
  readOnly,
}: {
  addOns: AddOn[];
  selectedIds: string[];
  onToggle?: (id: string, checked: boolean) => void;
  readOnly?: boolean;
}) {
  if (addOns.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="font-tag text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Optional add-ons
      </p>
      <div className="mt-3 space-y-2">
        {addOns.map((addOn) => {
          const checked = selectedIds.includes(addOn.id);
          return (
            <label
              key={addOn.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3.5 transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                checked ? "border-primary bg-accent shadow-sm" : "border-border bg-white",
                readOnly ? "cursor-default" : "cursor-pointer hover:border-primary/60 active:scale-[0.99]"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                  checked ? "border-primary bg-primary text-white" : "border-border bg-white"
                )}
              >
                {checked ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={readOnly}
                onChange={(e) => onToggle?.(addOn.id, e.target.checked)}
              />
              <span className="flex flex-1 items-center justify-between gap-3">
                <span className="text-sm font-medium">{addOn.label}</span>
                <span className="whitespace-nowrap text-right">
                  <span className="block text-sm font-bold">{addOn.displayString}</span>
                  <DiscountNote item={addOn} intervalMonths={addOn.intervalMonths} align="right" />
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Display-only future / Phase-2 lines: shown with pricing, never billed. */
export function FutureItems({ items }: { items: FutureItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="font-tag text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Later phases
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Shown for planning. Billed separately when each begins, not collected today.
      </p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-dashed border-border bg-surface/60 p-3.5"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Starts: {item.startsNote}
              </span>
            </span>
            <span className="whitespace-nowrap text-right">
              <span className="block text-sm font-bold">
                {formatPricedLine(item.amountCents, item.intervalMonths)}
              </span>
              <DiscountNote item={item} intervalMonths={item.intervalMonths} align="right" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Payment-schedule banner shown when a deposit is taken. */
export function DepositScheduleBanner({ schedule }: { schedule: DepositScheduleInfo }) {
  const lines: string[] = [];
  if (schedule.depositAmountCents != null && schedule.remainingCents != null) {
    lines.push(
      `Due at signing: ${formatCents(schedule.depositAmountCents)} (${schedule.depositPercent}% deposit).`
    );
    lines.push(
      `The remaining ${formatCents(schedule.remainingCents)} is collected when the build is complete.`
    );
  } else {
    lines.push(
      `A ${schedule.depositPercent}% deposit on the build fee is due at signing. The rest is collected when the build is complete.`
    );
  }
  if (schedule.deferredRecurring) {
    lines.push(
      `Your ${schedule.deferredRecurring.displayString} retainer starts when work begins.`
    );
  }
  return (
    <div className="mt-6 rounded-xl border border-primary/30 bg-accent/50 p-4">
      <p className="font-tag text-[11px] font-semibold uppercase tracking-widest text-primary">
        Payment schedule
      </p>
      <div className="mt-2 space-y-1 text-sm leading-relaxed">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export type SignaturePlace = "proposal" | "agreement";

export interface SignerSlot {
  name: string;
  detail: string;
  signedAt: string | null;
  signatureImageUrl: string | null;
  /** True for the party currently viewing the signing page. */
  isSelf?: boolean;
}

/** Wiring for the two-place signing ceremony on the signing page. */
export interface SigningInteraction {
  adoptedPngDataUrl: string | null;
  stamped: Record<SignaturePlace, boolean>;
  /** The field the signer should act on next; gets the attention ring. */
  activePlace: SignaturePlace | null;
  onStamp: (place: SignaturePlace) => void;
  onRequestAdopt: () => void;
}

function SignatureSlotBox({
  slot,
  place,
  signing,
}: {
  slot: SignerSlot;
  place: SignaturePlace;
  signing?: SigningInteraction;
}) {
  const interactive = Boolean(slot.isSelf && signing && !slot.signedAt);
  const stampedHere = interactive && Boolean(signing?.stamped[place]);
  const isActive = interactive && !stampedHere && signing?.activePlace === place;

  return (
    <div
      data-signature-slot={interactive ? place : undefined}
      className={cn(
        "rounded-xl border p-4 transition-[border-color,background-color,box-shadow] duration-200",
        interactive && !stampedHere ? "border-primary/60 bg-accent/40" : "border-border",
        isActive && "border-primary ring-2 ring-primary/70 ring-offset-2 ring-offset-surface"
      )}
    >
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
        ) : stampedHere && signing?.adoptedPngDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signing.adoptedPngDataUrl}
            alt="Your signature"
            className="max-h-14 max-w-[200px] object-contain"
          />
        ) : interactive ? (
          <button
            type="button"
            onClick={() =>
              signing?.adoptedPngDataUrl ? signing.onStamp(place) : signing?.onRequestAdopt()
            }
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/50 bg-white px-3 py-2.5 text-sm font-medium text-primary transition-[border-color,background-color,transform] duration-150 ease-out outline-none hover:border-primary hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98]"
          >
            <PenLine className="h-4 w-4" />
            {signing?.adoptedPngDataUrl ? "Tap to place your signature" : "Sign here"}
          </button>
        ) : slot.signedAt ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-success">
            <Check className="h-4 w-4" /> Signed
          </span>
        ) : (
          <span className="text-sm italic text-muted-foreground/60">Awaiting signature</span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {slot.signedAt
          ? `Signed ${slot.signedAt}`
          : stampedHere
            ? "Signed just now"
            : "Date: ____________"}
      </p>
    </div>
  );
}

function SignatureGrid({
  clientSlots,
  rslaSlot,
  place,
  signing,
}: {
  clientSlots: SignerSlot[];
  rslaSlot: SignerSlot;
  place: SignaturePlace;
  signing?: SigningInteraction;
}) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {[...clientSlots, rslaSlot].map((slot, i) => (
        <SignatureSlotBox key={i} slot={slot} place={place} signing={signing} />
      ))}
    </div>
  );
}

export function ProposalView({
  sections,
  selectedTierId,
  onTierSelect,
  tiersReadOnly,
  selectedAddOnIds = [],
  onAddOnToggle,
  addOnsReadOnly,
  depositScheduleOverride,
  clientSlots,
  rslaSlot,
  signing,
}: {
  sections: ProposalSections;
  selectedTierId: string | null;
  onTierSelect?: (tierId: string) => void;
  tiersReadOnly?: boolean;
  selectedAddOnIds?: string[];
  onAddOnToggle?: (id: string, checked: boolean) => void;
  addOnsReadOnly?: boolean;
  /** Live schedule from the signing page; overrides the server-computed one. Undefined = use sections. */
  depositScheduleOverride?: DepositScheduleInfo | null;
  clientSlots: SignerSlot[];
  rslaSlot: SignerSlot;
  signing?: SigningInteraction;
}) {
  const depositSchedule =
    depositScheduleOverride !== undefined
      ? depositScheduleOverride
      : sections.investment.depositSchedule;
  return (
    <article className="document-page mx-auto max-w-3xl rounded-2xl border border-border bg-white px-6 py-10 sm:px-12 sm:py-14">
      {/* Cover */}
      <header className="border-b border-border pb-10">
        <Image src="/logomark.png" alt="RSL/A" width={40} height={40} className="rounded-lg" />
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
        {sections.trackRecord ? (
          <>
            <SectionHeading>
              {sections.trackRecord.heading}
              <NoteMark n={sections.trackRecord.noteNumber} />
            </SectionHeading>
            {sections.trackRecord.intro ? <p>{sections.trackRecord.intro}</p> : null}
            <ul className="mt-3 space-y-2.5">
              {sections.trackRecord.caseStudies.map((cs, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 text-primary">•</span>
                  {cs.href ? (
                    <a
                      href={cs.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-border underline-offset-4 hover:text-primary hover:decoration-primary"
                    >
                      {cs.text}
                    </a>
                  ) : (
                    <span>{cs.text}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {/* Scope */}
        <SectionHeading>{sections.scope.heading}</SectionHeading>
        <p>{sections.scope.intro}</p>
        <div className="mt-3">
          <Bullets items={sections.scope.items} />
        </div>
        <p className="mt-4">
          {sections.scope.outro}
          <NoteMark n={sections.scope.noteNumber} />
        </p>

        {/* Timeline */}
        <SectionHeading>{sections.timeline.heading}</SectionHeading>
        <p>{sections.timeline.intro}</p>
        <div className="mt-3">
          <Bullets items={sections.timeline.items} />
        </div>
        <p className="mt-4">
          {sections.timeline.outro}
          <NoteMark n={sections.timeline.noteNumber} />
        </p>

        {/* Investment */}
        <SectionHeading>{sections.investment.heading}</SectionHeading>
        <p>
          {sections.investment.note}
          <NoteMark n={sections.investment.noteNumber} />
        </p>
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
        <FlatPricing
          oneTime={sections.investment.flatOneTime}
          recurring={sections.investment.flatRecurring}
        />
        {sections.investment.tiers ? (
          <TierCards
            tiers={sections.investment.tiers}
            selectedTierId={selectedTierId}
            onSelect={onTierSelect}
            readOnly={tiersReadOnly}
          />
        ) : null}
        {sections.investment.addOns && sections.investment.addOns.length > 0 ? (
          <AddOnPicker
            addOns={sections.investment.addOns}
            selectedIds={selectedAddOnIds}
            onToggle={onAddOnToggle}
            readOnly={addOnsReadOnly}
          />
        ) : null}
        {depositSchedule ? <DepositScheduleBanner schedule={depositSchedule} /> : null}
        {sections.investment.futureItems && sections.investment.futureItems.length > 0 ? (
          <FutureItems items={sections.investment.futureItems} />
        ) : null}

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

        {/* Acceptance: first signing place */}
        <SectionHeading>{sections.acceptance.heading}</SectionHeading>
        <p>{sections.acceptance.text}</p>
        <SignatureGrid
          clientSlots={clientSlots}
          rslaSlot={rslaSlot}
          place="proposal"
          signing={signing}
        />

        {/* Notes: numbered fine print, anchored from the superscripts above */}
        <div className="mt-12 border-t border-border pt-6">
          <p className="font-tag text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Notes
          </p>
          <ol className="mt-3 space-y-2">
            {sections.notes.map((note) => (
              <li
                key={note.id}
                id={note.id}
                className="flex scroll-mt-24 gap-2.5 text-xs leading-relaxed text-muted-foreground"
              >
                <span className="font-semibold text-foreground/60">{note.number}.</span>
                <span>{note.text}</span>
              </li>
            ))}
          </ol>
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

          {/* Execution: second signing place, mirrored in the PDF */}
          <div
            id="execution-block"
            className="mt-10 scroll-mt-24 border-t-2 border-foreground pt-6"
          >
            <h3 className="font-heading text-lg font-bold">{sections.execution.heading}</h3>
            <p className="mt-2 text-sm leading-relaxed">{sections.execution.text}</p>
            <SignatureGrid
              clientSlots={clientSlots}
              rslaSlot={rslaSlot}
              place="agreement"
              signing={signing}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
