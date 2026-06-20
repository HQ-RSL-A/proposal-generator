import path from "path";
import React from "react";
import {
  Document,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { DepositScheduleInfo, ProposalSections } from "@/lib/proposalContent";
import type { AddOn, FutureItem, OneTimeItem, RecurringItem, TierConfig } from "@/lib/types";
import { discountDisplay, formatCents, formatPricedLine, hasDiscount } from "@/lib/currency";

const fontsDir = path.join(process.cwd(), "public", "fonts");
const logoPath = path.join(process.cwd(), "public", "logomark.png");

// Brand pairing, identical to the web app: Satoshi for headings, Inter for
// body. Satoshi loads from the original OTFs (never convert — a TTF
// conversion once corrupted the lowercase "i"). Inter statics are extracted
// losslessly from the official Inter.ttc release.
Font.register({
  family: "Satoshi",
  fonts: [
    { src: path.join(fontsDir, "Satoshi-Regular.otf"), fontWeight: 400 },
    { src: path.join(fontsDir, "Satoshi-Medium.otf"), fontWeight: 500 },
    { src: path.join(fontsDir, "Satoshi-Bold.otf"), fontWeight: 700 },
    { src: path.join(fontsDir, "Satoshi-Black.otf"), fontWeight: 900 },
  ],
});
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(fontsDir, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontsDir, "Inter-Medium.ttf"), fontWeight: 500 },
    { src: path.join(fontsDir, "Inter-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(fontsDir, "Inter-Bold.ttf"), fontWeight: 700 },
  ],
});

// No hyphenation: cleaner line breaks for legal text.
Font.registerHyphenationCallback((word) => [word]);

// Palette mirrors the web design tokens in globals.css exactly:
// --primary #0070F3 (Anchor Blue), --foreground #111827, --muted-foreground
// #6B7280, --border #E5E7EB, --accent #F0F4FF, --surface #F9FAFB, --success.
const BLUE = "#0070F3";
const SLATE = "#111827"; // --foreground
const BODY = "#111827"; // body text == foreground on the web
const MUTED = "#6B7280"; // --muted-foreground
const FAINT = "#9CA3AF";
const BORDER = "#E5E7EB"; // --border
const HAIRLINE = "#F0F1F3";
const ACCENT = "#F0F4FF"; // --accent (selected cards, step badges, deposit box)
const ACCENT_BORDER = "#C7DBFB"; // accent box / selected hairline (primary @ ~30%)
const SURFACE = "#F9FAFB"; // --surface (glance label column)

// Orphan control: a section heading relocates to the next page when fewer than
// this many points remain, so a heading never strands alone at a page bottom.
const HEADING_PRESENCE = 72;

const s = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 60,
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 10,
    color: BODY,
    lineHeight: 1.55,
  },
  logo: { width: 30, height: 30, borderRadius: 6 },
  coverHeader: {
    borderBottomWidth: 0.75,
    borderBottomColor: BORDER,
    paddingBottom: 24,
    marginBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 60,
    right: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: FAINT,
  },
  h1: {
    fontFamily: "Satoshi",
    fontWeight: 900,
    fontSize: 25,
    lineHeight: 1.2,
    letterSpacing: -0.5,
    color: SLATE,
    marginBottom: 10,
  },
  // Section headings: Anchor Blue, like every heading on the web document.
  h2: {
    fontFamily: "Satoshi",
    fontWeight: 700,
    fontSize: 13.5,
    letterSpacing: -0.3,
    color: BLUE,
    marginTop: 24,
    marginBottom: 8,
  },
  microLabel: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  para: { marginBottom: 9 },
  bold: { fontWeight: 700 },
  semibold: { fontWeight: 600 },
  noteMark: { fontSize: 6, color: BLUE, verticalAlign: "super" },
  bulletRow: { flexDirection: "row", marginBottom: 5, paddingRight: 8 },
  bulletDot: { width: 13, color: BLUE }, // blue dots, like the web
  // At a Glance: bordered, rounded table with a surface label column.
  glanceTable: {
    marginTop: 10,
    borderWidth: 0.75,
    borderColor: BORDER,
    borderRadius: 8,
    // Clip the surface label-cell fill to the rounded corners (like the web's
    // overflow-hidden); without this the left corners render square/broken.
    overflow: "hidden",
  },
  glanceRow: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: BORDER },
  glanceLabelCell: {
    width: 150,
    backgroundColor: SURFACE,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 9,
    color: SLATE,
  },
  glanceValueCell: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, fontSize: 9, color: BODY },
  link: { color: BLUE, textDecoration: "underline" },
  // Signature cards: bordered, rounded, mirrors the web SignatureSlotBox.
  sigGrid: { flexDirection: "row", marginTop: 14 },
  sigCard: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
  },
  sigName: { fontWeight: 600, fontSize: 10, color: SLATE },
  sigDetail: { fontSize: 8, color: MUTED, marginTop: 1.5 },
  sigImageLine: {
    marginTop: 10,
    height: 44,
    borderBottomWidth: 0.75,
    borderBottomColor: BORDER,
    justifyContent: "flex-end",
    paddingBottom: 2,
  },
  sigImage: { height: 38, width: 150, objectFit: "contain", objectPosition: "left" },
  sigDate: { fontSize: 8, color: MUTED, marginTop: 6 },
  // How to proceed: numbered circle badges (accent fill, blue number).
  stepRow: { flexDirection: "row", marginBottom: 7, alignItems: "flex-start" },
  stepBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  // lineHeight 1 + centered text seat the digit dead-center in the circle
  // (react-pdf otherwise drops it low on the baseline).
  stepNum: {
    fontFamily: "Satoshi",
    fontWeight: 700,
    fontSize: 8,
    color: BLUE,
    lineHeight: 1,
    textAlign: "center",
  },
  // Deposit payment schedule: bordered accent box.
  payBox: {
    marginTop: 14,
    borderWidth: 0.75,
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT,
    borderRadius: 8,
    padding: 12,
  },
  notesBlock: {
    marginTop: 22,
    borderTopWidth: 0.75,
    borderTopColor: BORDER,
    paddingTop: 12,
  },
  noteRow: { flexDirection: "row", marginBottom: 4, paddingRight: 8 },
  noteNum: { width: 13, fontSize: 7.5, color: FAINT, fontWeight: 600 },
  noteText: { flex: 1, fontSize: 7.5, color: MUTED, lineHeight: 1.5 },
  // Tier cards.
  tierGrid: { flexDirection: "row", marginTop: 14 },
  tierPill: {
    alignSelf: "flex-start",
    backgroundColor: BLUE,
    borderRadius: 7,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginBottom: 7,
  },
  tierPillText: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 6.5,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  checkCircle: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  checkGlyph: {
    fontSize: 7.5,
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontWeight: 700,
    lineHeight: 1,
    textAlign: "center",
  },
  // Add-on rows: checkbox squares, like the web AddOnPicker.
  addOnRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.75,
    borderColor: BORDER,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  addOnRowSel: { borderColor: BLUE, backgroundColor: ACCENT },
  checkbox: {
    width: 13,
    height: 13,
    borderRadius: 3,
    borderWidth: 0.75,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkboxSel: { backgroundColor: BLUE, borderColor: BLUE },
  // E-signature certificate
  certFrame: {
    borderWidth: 1.2,
    borderColor: BLUE,
    borderRadius: 8,
    padding: 22,
    flexGrow: 1,
  },
  certHeading: {
    fontFamily: "Satoshi",
    fontWeight: 900,
    fontSize: 21,
    lineHeight: 1.15,
    letterSpacing: -0.4,
    color: SLATE,
    marginBottom: 6,
  },
  certMeta: { fontSize: 8.5, color: MUTED },
  certHeadRow: {
    flexDirection: "row",
    borderBottomWidth: 1.2,
    borderBottomColor: SLATE,
    paddingBottom: 6,
    marginTop: 18,
    marginBottom: 4,
  },
  certSignerRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: BORDER,
    paddingVertical: 12,
  },
  certColLeft: { width: "52%", paddingRight: 12 },
  certColRight: { width: "48%" },
  certName: { fontWeight: 700, fontSize: 10.5, color: SLATE },
  certDetail: { fontSize: 8, color: MUTED, marginTop: 1.5 },
  certSigBox: {
    borderWidth: 0.75,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 8,
    height: 54,
    justifyContent: "center",
  },
  mono: { fontFamily: "Courier", fontSize: 7.5, color: MUTED },
});

/** Superscript number linking to the matching note in the Notes block. */
function NoteMark({ n }: { n: number }) {
  return (
    <Link src={`#note-${n}`} style={{ textDecoration: "none" }}>
      <Text style={s.noteMark}>{` ${n}`}</Text>
    </Link>
  );
}

/** Section heading in Anchor Blue with orphan control, mirroring the web h2. */
function H2({ children }: { children: React.ReactNode }) {
  return (
    <Text style={s.h2} minPresenceAhead={HEADING_PRESENCE}>
      {children}
    </Text>
  );
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={s.bulletRow} wrap={false}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={{ flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// Static content only: react-pdf corrupts layout boxes ("unsupported number")
// when a fixed element contains a dynamic render-callback Text and the page's
// content flows across many sheets. No page numbers, by hard-won design.
function PageFooter({ left }: { left: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{left}</Text>
      <Link src="https://rsla.io" style={{ color: BLUE, textDecoration: "none" }}>
        rsla.io
      </Link>
    </View>
  );
}

/** At a Glance: bordered table, surface label column, sentence-case labels. */
function GlanceTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <View style={s.glanceTable} wrap={false}>
      {rows.map((row, i) => (
        <View
          key={i}
          style={[s.glanceRow, i === rows.length - 1 ? { borderBottomWidth: 0 } : {}]}
        >
          <Text style={s.glanceLabelCell}>{row.label}</Text>
          <Text style={s.glanceValueCell}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Struck-through original + reason under a discounted line. Mirrors the web DiscountNote. */
function DiscountNote({
  item,
  intervalMonths,
}: {
  item: { amountCents: number; discount?: { amountCents: number; reason: string } | null };
  intervalMonths: 1 | 3 | 12 | null;
}) {
  const d = discountDisplay(item, intervalMonths);
  if (!d) return null;
  return (
    <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 1 }}>
      {/* react-pdf can't carry an aria-label like the web DiscountNote (RSL-33), so a literal "was"
          gives the struck original its was/now meaning when the PDF text is linearized. RSL-35. */}
      {"was "}
      <Text style={{ textDecoration: "line-through" }}>{d.originalLabel}</Text>
      {" "}
      <Text style={{ color: BLUE }}>{d.reason}</Text>
    </Text>
  );
}

/** Flat pricing summary, shown only when a flat line is discounted. Mirrors the web FlatPricing. */
function FlatPricingTable({
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
    <View style={{ marginTop: 14 }} wrap={false}>
      <Text style={[s.microLabel, { marginBottom: 6 }]}>Pricing</Text>
      {lines.map((l, i) => (
        <View key={i} style={s.addOnRow}>
          <Text style={{ flex: 1, fontWeight: 500 }}>{l.item.label}</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontWeight: 700, color: SLATE }}>
              {formatPricedLine(l.item.amountCents, l.intervalMonths)}
            </Text>
            <DiscountNote item={l.item} intervalMonths={l.intervalMonths} />
          </View>
        </View>
      ))}
    </View>
  );
}

function TierTable({ tiers, selectedTierId }: { tiers: TierConfig[]; selectedTierId: string | null }) {
  return (
    <View style={s.tierGrid} wrap={false}>
      {tiers.map((tier) => {
        const isSelected = tier.id === selectedTierId;
        // Match the web: only the chosen tier highlights; recommended is a badge.
        const highlight = isSelected;
        return (
          <View
            key={tier.id}
            style={{
              flex: 1,
              borderWidth: highlight ? 1.2 : 0.75,
              borderColor: highlight ? BLUE : BORDER,
              borderRadius: 8,
              padding: 11,
              marginRight: 8,
              backgroundColor: highlight ? ACCENT : "#FFFFFF",
            }}
          >
            {tier.recommended ? (
              <View style={s.tierPill}>
                <Text style={s.tierPillText}>Recommended</Text>
              </View>
            ) : null}
            <View
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            >
              <Text
                style={{
                  fontFamily: "Satoshi",
                  fontWeight: 700,
                  fontSize: 10.5,
                  color: highlight ? BLUE : SLATE,
                }}
              >
                {tier.label}
              </Text>
              {isSelected ? (
                <View style={s.checkCircle}>
                  <Text style={s.checkGlyph}>✓</Text>
                </View>
              ) : null}
            </View>
            <View style={{ marginTop: 5 }}>
              {tier.oneTime ? (
                <>
                  <Text style={{ fontWeight: 600, fontSize: 10 }}>{tier.oneTime.displayString}</Text>
                  <DiscountNote item={tier.oneTime} intervalMonths={null} />
                </>
              ) : null}
              {tier.recurring ? (
                <>
                  <Text style={{ fontWeight: 600, fontSize: 10, marginTop: tier.oneTime ? 1 : 0 }}>
                    {tier.recurring.displayString}
                  </Text>
                  <DiscountNote
                    item={tier.recurring}
                    intervalMonths={tier.recurring.intervalMonths}
                  />
                </>
              ) : null}
            </View>
            <View
              style={{
                marginTop: 7,
                borderTopWidth: 0.75,
                borderTopColor: highlight ? ACCENT_BORDER : HAIRLINE,
                paddingTop: 6,
              }}
            >
              {tier.includes.map((line, i) => (
                <Text key={i} style={{ fontSize: 7.5, color: MUTED, marginBottom: 2.5 }}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Global add-ons as checkbox rows, with the chosen ones marked. Mirrors the web AddOnPicker. */
function AddOnsTable({ addOns, selectedIds }: { addOns: AddOn[]; selectedIds: string[] }) {
  if (addOns.length === 0) return null;
  return (
    <View style={{ marginTop: 14 }} wrap={false}>
      <Text style={[s.microLabel, { marginBottom: 6 }]}>Optional add-ons</Text>
      {addOns.map((addOn) => {
        const selected = selectedIds.includes(addOn.id);
        return (
          <View key={addOn.id} style={[s.addOnRow, selected ? s.addOnRowSel : {}]}>
            <View style={[s.checkbox, selected ? s.checkboxSel : {}]}>
              {selected ? <Text style={s.checkGlyph}>✓</Text> : null}
            </View>
            <Text style={{ flex: 1, fontWeight: 500 }}>{addOn.label}</Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontWeight: 700, color: SLATE }}>{addOn.displayString}</Text>
              <DiscountNote item={addOn} intervalMonths={addOn.intervalMonths} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Payment-schedule block shown when a deposit is taken: bordered accent box. */
function DepositScheduleBlock({ schedule }: { schedule: DepositScheduleInfo }) {
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
    lines.push(`Your ${schedule.deferredRecurring.displayString} retainer starts when work begins.`);
  }
  return (
    <View style={s.payBox} wrap={false}>
      <Text style={[s.microLabel, { color: BLUE, marginBottom: 4 }]}>Payment schedule</Text>
      {lines.map((line, i) => (
        <Text key={i} style={{ fontSize: 9.5, marginBottom: 1.5 }}>
          {line}
        </Text>
      ))}
    </View>
  );
}

/** Display-only future / Phase-2 lines: shown with pricing, never billed. Mirrors the web FutureItems. */
function FutureItemsTable({ items }: { items: FutureItem[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginTop: 14 }} wrap={false}>
      <Text style={[s.microLabel, { marginBottom: 2 }]}>Later phases</Text>
      <Text style={{ fontSize: 8.5, color: MUTED, marginBottom: 6 }}>
        Shown for planning. Billed separately when each begins, not collected today.
      </Text>
      {items.map((item) => (
        <View
          key={item.id}
          style={[
            s.addOnRow,
            { alignItems: "flex-start", borderStyle: "dashed", backgroundColor: SURFACE },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 500 }}>{item.label}</Text>
            <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 1 }}>
              Starts: {item.startsNote}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontWeight: 700, color: SLATE }}>
              {formatPricedLine(item.amountCents, item.intervalMonths)}
            </Text>
            <DiscountNote item={item} intervalMonths={item.intervalMonths} />
          </View>
        </View>
      ))}
    </View>
  );
}

export interface SignerCertInfo {
  name: string;
  email: string;
  role: string;
  method: string;
  adoptedName: string;
  signerTitle: string;
  signerCompany: string;
  viewedAt: string | null;
  signedAt: string | null;
  ipAddress: string | null;
  signatureDataUri: string | null;
  /** Preformatted line describing the two-place ceremony, when recorded. */
  placements: string | null;
}

export interface CertificateInfo {
  referenceId: string;
  versionNumber: number;
  contentHash: string;
  agreementVersion: string;
  sentAt: string;
  completedAt: string;
}

/** Signature card used on the Acceptance section and the MSA execution block. Mirrors the web SignatureSlotBox. */
function SignatureCard({
  signer,
  fallbackName,
  fallbackDetail,
}: {
  signer: SignerCertInfo | undefined;
  fallbackName: string;
  fallbackDetail: string;
}) {
  return (
    <View style={s.sigCard} wrap={false}>
      <Text style={s.sigName}>{signer?.name ?? fallbackName}</Text>
      <Text style={s.sigDetail}>
        {signer ? `${signer.signerTitle}, ${signer.signerCompany}` : fallbackDetail}
      </Text>
      <View style={s.sigImageLine}>
        {signer?.signatureDataUri ? (
          <Image src={signer.signatureDataUri} style={s.sigImage} />
        ) : null}
      </View>
      <Text style={s.sigDate}>
        {signer?.signedAt ? `Signed ${signer.signedAt}` : "Date: ____________________"}
      </Text>
    </View>
  );
}

/** The two-column signature grid (clients + RSL/A), kept together on one page. */
function SignatureGrid({
  firstClient,
  admin,
  extraClients,
  sections,
}: {
  firstClient: SignerCertInfo | undefined;
  admin: SignerCertInfo | undefined;
  extraClients: SignerCertInfo[];
  sections: ProposalSections;
}) {
  return (
    <>
      <View style={s.sigGrid} wrap={false}>
        <SignatureCard
          signer={firstClient}
          fallbackName={sections.acceptance.clientName}
          fallbackDetail={sections.acceptance.clientCompany}
        />
        <SignatureCard
          signer={admin}
          fallbackName={sections.acceptance.rslaName}
          fallbackDetail={sections.acceptance.rslaTitle}
        />
      </View>
      {extraClients.length > 0 ? (
        <View style={[s.sigGrid, { marginTop: 10 }]} wrap={false}>
          {extraClients.map((signer, i) => (
            <SignatureCard
              key={i}
              signer={signer}
              fallbackName={signer.name}
              fallbackDetail={signer.signerCompany}
            />
          ))}
        </View>
      ) : null}
    </>
  );
}

export function ProposalPdf({
  sections,
  signers,
  certificate,
  selectedTierId,
  selectedAddOnIds = [],
}: {
  sections: ProposalSections;
  signers: SignerCertInfo[];
  certificate: CertificateInfo;
  selectedTierId: string | null;
  selectedAddOnIds?: string[];
}) {
  const admin = signers.find((p) => p.role === "ADMIN_SIGNER");
  const clientSigners = signers.filter((p) => p.role === "CLIENT_SIGNER");
  const firstClient = clientSigners[0];
  const extraClients = clientSigners.slice(1);
  const footerLeft = `${sections.acceptance.clientCompany} · Proposal & Service Agreement`;

  const investmentDetailLines = sections.investment.details
    .split("\n")
    .filter((l) => l.trim());

  return (
    <Document
      title={sections.cover.title}
      author="RSL/A LLC"
      subject="Proposal + Master Services Agreement"
    >
      {/* The whole proposal flows continuously, paginating itself; sections stay
          intact via wrap={false} atoms + heading minPresenceAhead. */}
      <Page size="LETTER" style={s.page}>
        {/* Cover */}
        <View style={s.coverHeader}>
          <Image src={logoPath} style={[s.logo, { marginBottom: 44 }]} />
          <Text style={s.h1}>{sections.cover.title}</Text>
          <Text style={{ color: MUTED, fontSize: 10.5, lineHeight: 1.5 }}>
            {sections.cover.subtitle}
          </Text>
        </View>

        {/* At a Glance */}
        <H2>At a Glance</H2>
        <Text style={s.para}>{sections.atGlance.intro}</Text>
        <GlanceTable rows={sections.atGlance.rows} />

        {/* Problem */}
        <H2>{sections.problem.title}</H2>
        <Text style={s.para}>{sections.problem.greeting}</Text>
        {sections.problem.paragraphs.map((p, i) => (
          <Text key={i} style={s.para} wrap={false}>
            {p}
          </Text>
        ))}
        <Text style={s.para}>{sections.problem.contactLine}</Text>
        {sections.problem.signOff.map((line, i) => (
          <Text key={i} style={i === 0 ? { marginTop: 6 } : s.semibold}>
            {line}
          </Text>
        ))}

        {/* Solution */}
        <H2>{sections.solution.title}</H2>
        <Text style={[s.para, { color: MUTED }]}>{sections.solution.intro}</Text>
        {sections.solution.paragraphs.map((p, i) => (
          <Text key={i} style={s.para} wrap={false}>
            {p}
          </Text>
        ))}
        <Text style={s.para}>{sections.solution.outro}</Text>

        {/* Track record */}
        {sections.trackRecord ? (
          <>
            <H2>
              {sections.trackRecord.heading}
              <NoteMark n={sections.trackRecord.noteNumber} />
            </H2>
            {sections.trackRecord.intro ? (
              <Text style={s.para}>{sections.trackRecord.intro}</Text>
            ) : null}
            {sections.trackRecord.caseStudies.map((cs, i) => (
              <View key={i} style={s.bulletRow} wrap={false}>
                <Text style={s.bulletDot}>•</Text>
                {cs.href ? (
                  <Link src={cs.href} style={[s.link, { flex: 1 }]}>
                    {cs.text}
                  </Link>
                ) : (
                  <Text style={{ flex: 1 }}>{cs.text}</Text>
                )}
              </View>
            ))}
          </>
        ) : null}

        {/* Scope */}
        <H2>{sections.scope.heading}</H2>
        <Text style={s.para}>{sections.scope.intro}</Text>
        <Bullets items={sections.scope.items} />
        <Text style={[s.para, { marginTop: 6 }]}>
          {sections.scope.outro}
          <NoteMark n={sections.scope.noteNumber} />
        </Text>

        {/* Timeline */}
        <H2>{sections.timeline.heading}</H2>
        <Text style={s.para}>{sections.timeline.intro}</Text>
        <Bullets items={sections.timeline.items} />
        <Text style={[s.para, { marginTop: 6 }]}>
          {sections.timeline.outro}
          <NoteMark n={sections.timeline.noteNumber} />
        </Text>

        {/* Investment */}
        <H2>{sections.investment.heading}</H2>
        <Text style={s.para}>
          {sections.investment.note}
          <NoteMark n={sections.investment.noteNumber} />
        </Text>
        {investmentDetailLines.map((line, i) => (
          <Text key={i} style={[s.para, { fontWeight: 600, marginBottom: 3 }]}>
            {line}
          </Text>
        ))}
        <FlatPricingTable
          oneTime={sections.investment.flatOneTime}
          recurring={sections.investment.flatRecurring}
        />
        {sections.investment.tiers ? (
          <TierTable tiers={sections.investment.tiers} selectedTierId={selectedTierId} />
        ) : null}
        {sections.investment.addOns && sections.investment.addOns.length > 0 ? (
          <AddOnsTable addOns={sections.investment.addOns} selectedIds={selectedAddOnIds} />
        ) : null}
        {sections.investment.depositSchedule ? (
          <DepositScheduleBlock schedule={sections.investment.depositSchedule} />
        ) : null}
        {sections.investment.futureItems && sections.investment.futureItems.length > 0 ? (
          <FutureItemsTable items={sections.investment.futureItems} />
        ) : null}

        {/* How to proceed */}
        <View wrap={false}>
          <H2>{sections.howToProceed.heading}</H2>
          <Text style={s.para}>{sections.howToProceed.intro}</Text>
          {sections.howToProceed.steps.map((step, i) => (
            <View key={i} style={s.stepRow}>
              <View style={s.stepBadge}>
                <Text style={s.stepNum}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1 }}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Acceptance: first signing place — heading, text and signatures stay together */}
        <View wrap={false}>
          <H2>{sections.acceptance.heading}</H2>
          <Text style={s.para}>{sections.acceptance.text}</Text>
          <SignatureGrid
            firstClient={firstClient}
            admin={admin}
            extraClients={extraClients}
            sections={sections}
          />
        </View>

        {/* Notes: numbered fine print, destinations for the superscript markers */}
        <View style={s.notesBlock} wrap={false}>
          <Text style={[s.microLabel, { marginBottom: 6 }]}>Notes</Text>
          {sections.notes.map((note) => (
            <View key={note.id} id={note.id} style={s.noteRow}>
              <Text style={s.noteNum}>{note.number}.</Text>
              <Text style={s.noteText}>{note.text}</Text>
            </View>
          ))}
        </View>
        <PageFooter left={footerLeft} />
      </Page>

      {/* MSA — starts on a fresh page; blocks flow and relocate whole. */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>{sections.msa.heading}</Text>
        <Text style={s.para}>
          Prepared for: <Text style={s.semibold}>{sections.msa.preparedFor}</Text>
        </Text>
        {sections.msa.blocks.map((block, i) => {
          if (block.type === "heading") {
            return (
              <Text
                key={i}
                style={[s.h2, { fontSize: 11, marginTop: 18 }]}
                minPresenceAhead={HEADING_PRESENCE}
              >
                {block.text}
              </Text>
            );
          }
          const runs = block.runs.map((run, j) => (
            <Text key={j} style={run.bold ? s.semibold : undefined}>
              {run.text}
            </Text>
          ));
          if (block.type === "bullet") {
            return (
              <View key={i} style={s.bulletRow} wrap={false}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={{ flex: 1, fontSize: 9.5 }}>{runs}</Text>
              </View>
            );
          }
          return (
            <Text key={i} style={[s.para, { fontSize: 9.5 }]} wrap={false}>
              {runs}
            </Text>
          );
        })}

        {/* Execution of the agreement itself: the second signing place. */}
        <View
          wrap={false}
          style={{ marginTop: 26, borderTopWidth: 1.2, borderTopColor: SLATE, paddingTop: 14 }}
        >
          <Text style={[s.bold, { fontSize: 13, fontFamily: "Satoshi", letterSpacing: -0.3, color: SLATE }]}>
            {sections.execution.heading}
          </Text>
          <Text style={[s.para, { marginTop: 4 }]}>{sections.execution.text}</Text>
          <SignatureGrid
            firstClient={firstClient}
            admin={admin}
            extraClients={extraClients}
            sections={sections}
          />
        </View>
        <PageFooter left={footerLeft} />
      </Page>

      {/* E-Signature Certificate */}
      <Page size="LETTER" style={[s.page, { paddingTop: 40, paddingBottom: 40 }]}>
        <View style={s.certFrame}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <Text style={s.certHeading}>E-Signature Certificate</Text>
              <Text style={s.certMeta}>Reference: {certificate.referenceId}</Text>
            </View>
            <Image src={logoPath} style={{ width: 26, height: 26, borderRadius: 5 }} />
          </View>
          <Text style={[s.certMeta, { marginTop: 2 }]}>Sent on {certificate.sentAt}</Text>

          <View style={s.certHeadRow}>
            <Text style={[s.microLabel, { width: "52%" }]}>Signed by</Text>
            <Text style={[s.microLabel, { width: "48%" }]}>Signature</Text>
          </View>

          {signers.map((signer, i) => (
            <View key={i} style={s.certSignerRow} wrap={false}>
              <View style={s.certColLeft}>
                <Text style={s.certName}>{signer.name}</Text>
                <Text style={s.certDetail}>
                  {signer.signerTitle}, {signer.signerCompany}
                </Text>
                <Text style={s.certDetail}>{signer.email}</Text>
                {signer.viewedAt ? (
                  <Text style={[s.certDetail, { marginTop: 5 }]}>Viewed: {signer.viewedAt}</Text>
                ) : null}
                {signer.signedAt ? (
                  <Text style={s.certDetail}>Signed: {signer.signedAt}</Text>
                ) : null}
              </View>
              <View style={s.certColRight}>
                <View style={s.certSigBox}>
                  {signer.signatureDataUri ? (
                    <Image
                      src={signer.signatureDataUri}
                      style={{ height: 38, objectFit: "contain" }}
                    />
                  ) : (
                    <Text style={s.certDetail}>Pre-applied by sender</Text>
                  )}
                </View>
                <Text style={[s.certDetail, { marginTop: 4 }]}>{signer.method}</Text>
                {signer.placements ? (
                  <Text style={s.certDetail}>{signer.placements}</Text>
                ) : null}
                {signer.ipAddress ? (
                  <Text style={s.certDetail}>IP address: {signer.ipAddress}</Text>
                ) : null}
              </View>
            </View>
          ))}

          <Text style={[s.para, { marginTop: 16, fontSize: 9.5 }]}>
            Document completed by all parties on{" "}
            <Text style={s.semibold}>{certificate.completedAt}</Text>
          </Text>

          <View style={{ marginTop: "auto" }}>
            <Text style={[s.certDetail, { marginTop: 14 }]}>
              Executed electronically under the federal E-SIGN Act, the New York Electronic
              Signatures and Records Act (ESRA), and the Uniform Electronic Transactions Act
              (UETA). Agreement version {certificate.agreementVersion} (document v
              {certificate.versionNumber}).
            </Text>
            <Text style={[s.certDetail, { marginTop: 4 }]}>
              Document integrity: SHA-256 fingerprint of the content frozen at send.
            </Text>
            <Text style={s.mono}>{certificate.contentHash}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
