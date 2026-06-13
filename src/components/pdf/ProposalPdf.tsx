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
import type { ProposalSections } from "@/lib/proposalContent";
import type { TierConfig } from "@/lib/types";

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

const BLUE = "#0070F3";
const SLATE = "#111827";
const BODY = "#1F2937";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const BORDER = "#E5E7EB";
const HAIRLINE = "#F0F1F3";
const SELECTED_BG = "#F5F9FF";

const s = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 60,
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 9.5,
    color: BODY,
    lineHeight: 1.55,
  },
  logo: { width: 30, height: 30, borderRadius: 6 },
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
    color: SLATE,
    marginBottom: 12,
  },
  h2: {
    fontFamily: "Satoshi",
    fontWeight: 700,
    fontSize: 13,
    color: SLATE,
    marginTop: 26,
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
  bulletDot: { width: 13, color: FAINT },
  glanceRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: HAIRLINE,
    paddingVertical: 7,
  },
  glanceLabel: {
    width: 130,
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    paddingTop: 1.5,
  },
  glanceValue: { flex: 1, fontSize: 9.5, color: SLATE },
  link: { color: BLUE, textDecoration: "underline" },
  sigGrid: { flexDirection: "row", marginTop: 14 },
  sigCol: {
    flex: 1,
    borderTopWidth: 0.75,
    borderTopColor: BORDER,
    paddingTop: 10,
    marginRight: 18,
  },
  sigName: { fontWeight: 600, fontSize: 10, color: SLATE },
  sigImage: { height: 40, width: 150, objectFit: "contain", objectPosition: "left" },
  sigLine: { fontSize: 8.5, color: MUTED, marginTop: 2 },
  notesBlock: {
    marginTop: 22,
    borderTopWidth: 0.75,
    borderTopColor: BORDER,
    paddingTop: 12,
  },
  noteRow: { flexDirection: "row", marginBottom: 4, paddingRight: 8 },
  noteNum: { width: 13, fontSize: 7.5, color: FAINT, fontWeight: 600 },
  noteText: { flex: 1, fontSize: 7.5, color: MUTED, lineHeight: 1.5 },
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

function TierTable({ tiers, selectedTierId }: { tiers: TierConfig[]; selectedTierId: string | null }) {
  return (
    <View style={{ flexDirection: "row", marginTop: 12 }}>
      {tiers.map((tier) => {
        const isSelected = tier.id === selectedTierId;
        const highlight = isSelected || (!selectedTierId && tier.recommended);
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
              backgroundColor: highlight ? SELECTED_BG : "#FFFFFF",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
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
                <Text style={[s.microLabel, { color: BLUE }]}>Selected</Text>
              ) : tier.recommended ? (
                <Text style={s.microLabel}>Most popular</Text>
              ) : null}
            </View>
            <View style={{ marginTop: 5 }}>
              {tier.oneTime ? (
                <Text style={{ fontWeight: 600, fontSize: 10 }}>{tier.oneTime.displayString}</Text>
              ) : null}
              {tier.recurring ? (
                <Text style={{ fontWeight: 600, fontSize: 10, marginTop: tier.oneTime ? 1 : 0 }}>
                  {tier.recurring.displayString}
                </Text>
              ) : null}
            </View>
            <View
              style={{
                marginTop: 7,
                borderTopWidth: 0.75,
                borderTopColor: highlight ? "#D6E6FD" : HAIRLINE,
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

/** Signature block used on the Acceptance section and the MSA execution block. */
function SignatureBlock({
  signer,
  fallbackName,
  fallbackDetail,
}: {
  signer: SignerCertInfo | undefined;
  fallbackName: string;
  fallbackDetail: string;
}) {
  return (
    <View style={s.sigCol} wrap={false}>
      <Text style={s.sigName}>{signer?.name ?? fallbackName}</Text>
      <Text style={s.sigLine}>
        {signer ? `${signer.signerTitle}, ${signer.signerCompany}` : fallbackDetail}
      </Text>
      {signer?.signatureDataUri ? (
        <Image src={signer.signatureDataUri} style={[s.sigImage, { marginTop: 8 }]} />
      ) : (
        <Text style={[s.sigLine, { marginTop: 26 }]}>Signature: ____________________</Text>
      )}
      <Text style={s.sigLine}>
        {signer?.signedAt ? `Signed ${signer.signedAt}` : "Date: ____________________"}
      </Text>
    </View>
  );
}

export function ProposalPdf({
  sections,
  signers,
  certificate,
  selectedTierId,
}: {
  sections: ProposalSections;
  signers: SignerCertInfo[];
  certificate: CertificateInfo;
  selectedTierId: string | null;
}) {
  const admin = signers.find((p) => p.role === "ADMIN_SIGNER");
  const clientSigners = signers.filter((p) => p.role === "CLIENT_SIGNER");
  const firstClient = clientSigners[0];
  const footerLeft = `${sections.acceptance.clientCompany} · Proposal & Service Agreement`;

  return (
    <Document
      title={sections.cover.title}
      author="RSL/A LLC"
      subject="Proposal + Master Services Agreement"
    >
      {/* Cover + At a Glance */}
      <Page size="LETTER" style={s.page}>
        <Image src={logoPath} style={[s.logo, { marginBottom: 50 }]} />
        <Text style={s.h1}>{sections.cover.title}</Text>
        <Text style={[s.para, { color: MUTED, fontSize: 10 }]}>{sections.cover.subtitle}</Text>

        <Text style={s.h2}>At a Glance</Text>
        <Text style={s.para}>{sections.atGlance.intro}</Text>
        <View style={{ marginTop: 4 }}>
          {sections.atGlance.rows.map((row, i) => (
            <View
              key={i}
              style={[
                s.glanceRow,
                i === sections.atGlance.rows.length - 1 ? { borderBottomWidth: 0 } : {},
              ]}
            >
              <Text style={s.glanceLabel}>{row.label}</Text>
              <Text style={s.glanceValue}>{row.value}</Text>
            </View>
          ))}
        </View>
        <PageFooter left={footerLeft} />
      </Page>

      {/* Narrative */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h2}>{sections.problem.title}</Text>
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

        <Text style={s.h2}>{sections.solution.title}</Text>
        <Text style={[s.para, { color: MUTED }]}>{sections.solution.intro}</Text>
        {sections.solution.paragraphs.map((p, i) => (
          <Text key={i} style={s.para} wrap={false}>
            {p}
          </Text>
        ))}
        <Text style={s.para}>{sections.solution.outro}</Text>

        <Text style={s.h2}>{sections.trackRecord.heading}</Text>
        <Text style={s.para}>
          {sections.trackRecord.intro}
          <NoteMark n={sections.trackRecord.noteNumber} />
        </Text>
        {sections.trackRecord.caseStudies.map((cs, i) => (
          <View key={i} style={s.bulletRow} wrap={false}>
            <Text style={s.bulletDot}>•</Text>
            <Link src={cs.href} style={[s.link, { flex: 1 }]}>
              {cs.text}
            </Link>
          </View>
        ))}
        <PageFooter left={footerLeft} />
      </Page>

      {/* Scope + Timeline */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h2}>{sections.scope.heading}</Text>
        <Text style={s.para}>{sections.scope.intro}</Text>
        <Bullets items={sections.scope.items} />
        <Text style={[s.para, { marginTop: 6 }]}>
          {sections.scope.outro}
          <NoteMark n={sections.scope.noteNumber} />
        </Text>

        <Text style={s.h2}>{sections.timeline.heading}</Text>
        <Text style={s.para}>{sections.timeline.intro}</Text>
        <Bullets items={sections.timeline.items} />
        <Text style={[s.para, { marginTop: 6 }]}>
          {sections.timeline.outro}
          <NoteMark n={sections.timeline.noteNumber} />
        </Text>
        <PageFooter left={footerLeft} />
      </Page>

      {/* Investment + How to Proceed + Acceptance + Notes */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h2}>{sections.investment.heading}</Text>
        <Text style={s.para}>
          {sections.investment.note}
          <NoteMark n={sections.investment.noteNumber} />
        </Text>
        {sections.investment.details
          .split("\n")
          .filter((l) => l.trim())
          .map((line, i) => (
            <Text key={i} style={[s.para, { fontWeight: 600, marginBottom: 3 }]}>
              {line}
            </Text>
          ))}
        {sections.investment.tiers ? (
          <TierTable tiers={sections.investment.tiers} selectedTierId={selectedTierId} />
        ) : null}

        <Text style={s.h2}>{sections.howToProceed.heading}</Text>
        <Text style={s.para}>{sections.howToProceed.intro}</Text>
        {sections.howToProceed.steps.map((step, i) => (
          <View key={i} style={s.bulletRow} wrap={false}>
            <Text style={[s.bulletDot, { width: 18, color: BLUE, fontWeight: 600 }]}>{i + 1}.</Text>
            <Text style={{ flex: 1 }}>{step}</Text>
          </View>
        ))}

        <Text style={s.h2}>{sections.acceptance.heading}</Text>
        <Text style={s.para}>{sections.acceptance.text}</Text>
        <View style={s.sigGrid} wrap={false}>
          <SignatureBlock
            signer={firstClient}
            fallbackName={sections.acceptance.clientName}
            fallbackDetail={sections.acceptance.clientCompany}
          />
          <SignatureBlock
            signer={admin}
            fallbackName={sections.acceptance.rslaName}
            fallbackDetail={sections.acceptance.rslaTitle}
          />
        </View>
        {clientSigners.length > 1 ? (
          <View style={[s.sigGrid, { marginTop: 10 }]} wrap={false}>
            {clientSigners.slice(1).map((signer, i) => (
              <SignatureBlock
                key={i}
                signer={signer}
                fallbackName={signer.name}
                fallbackDetail={signer.signerCompany}
              />
            ))}
          </View>
        ) : null}

        {/* Numbered fine print, the destinations for the superscript markers */}
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

      {/* MSA */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>{sections.msa.heading}</Text>
        <Text style={s.para}>
          Prepared for: <Text style={s.semibold}>{sections.msa.preparedFor}</Text>
        </Text>
        {sections.msa.blocks.map((block, i) => {
          if (block.type === "heading") {
            return (
              <Text key={i} style={[s.h2, { fontSize: 11, marginTop: 18 }]}>
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
                <Text style={{ flex: 1, fontSize: 9 }}>{runs}</Text>
              </View>
            );
          }
          return (
            <Text key={i} style={[s.para, { fontSize: 9 }]} wrap={false}>
              {runs}
            </Text>
          );
        })}

        {/* Execution of the agreement itself: the second signing place. */}
        <View
          wrap={false}
          style={{ marginTop: 26, borderTopWidth: 1.2, borderTopColor: SLATE, paddingTop: 14 }}
        >
          <Text style={[s.bold, { fontSize: 12, fontFamily: "Satoshi", color: SLATE }]}>
            {sections.execution.heading}
          </Text>
          <Text style={[s.para, { marginTop: 4 }]}>{sections.execution.text}</Text>
          <View style={s.sigGrid}>
            <SignatureBlock
              signer={firstClient}
              fallbackName={sections.acceptance.clientName}
              fallbackDetail={sections.acceptance.clientCompany}
            />
            <SignatureBlock
              signer={admin}
              fallbackName={sections.acceptance.rslaName}
              fallbackDetail={sections.acceptance.rslaTitle}
            />
          </View>
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
