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

Font.register({
  family: "Satoshi",
  fonts: [
    { src: path.join(fontsDir, "Satoshi-Regular.otf"), fontWeight: 400 },
    { src: path.join(fontsDir, "Satoshi-Medium.otf"), fontWeight: 500 },
    { src: path.join(fontsDir, "Satoshi-Bold.otf"), fontWeight: 700 },
    { src: path.join(fontsDir, "Satoshi-Black.otf"), fontWeight: 900 },
  ],
});

// No hyphenation: cleaner line breaks for legal text.
Font.registerHyphenationCallback((word) => [word]);

const BLUE = "#0070F3";
const SLATE = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const SAND = "#F9FAFB";
const HIGHLIGHT = "#E8F1FE";

const s = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: SLATE,
    lineHeight: 1.55,
  },
  logo: { width: 30, height: 30 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: MUTED,
  },
  h1: { fontFamily: "Satoshi", fontWeight: 900, fontSize: 26, lineHeight: 1.2, marginBottom: 14 },
  h2: {
    fontFamily: "Satoshi",
    fontWeight: 700,
    fontSize: 16,
    color: BLUE,
    marginTop: 22,
    marginBottom: 10,
  },
  para: { marginBottom: 9 },
  bold: { fontFamily: "Helvetica-Bold" },
  fine: { fontSize: 8.5, color: MUTED, marginTop: 8 },
  bulletRow: { flexDirection: "row", marginBottom: 5, paddingRight: 8 },
  bulletDot: { width: 14, color: BLUE },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER },
  tableLabel: {
    width: "32%",
    padding: 8,
    backgroundColor: SAND,
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
  },
  tableValue: { width: "68%", padding: 8, fontSize: 9.5 },
  sigGrid: { flexDirection: "row", marginTop: 16 },
  sigCol: { flex: 1, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10, marginRight: 18 },
  sigImage: { height: 44, width: 150, objectFit: "contain", objectPosition: "left" },
  sigLine: { fontSize: 9, color: MUTED, marginTop: 2 },
  // E-signature certificate
  certFrame: {
    borderWidth: 2,
    borderColor: BLUE,
    borderRadius: 8,
    padding: 22,
    flexGrow: 1,
  },
  certHeading: { fontFamily: "Satoshi", fontWeight: 900, fontSize: 22, lineHeight: 1.15, marginBottom: 6 },
  certMeta: { fontSize: 9, color: MUTED },
  certHeadRow: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: SLATE,
    paddingBottom: 6,
    marginTop: 18,
    marginBottom: 4,
  },
  certSignerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 12,
  },
  certColLeft: { width: "52%", paddingRight: 12 },
  certColRight: { width: "48%" },
  certLabel: {
    fontFamily: "Satoshi",
    fontWeight: 700,
    fontSize: 9,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  certName: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  certDetail: { fontSize: 8.5, color: MUTED, marginTop: 1.5 },
  certSigBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 8,
    height: 56,
    justifyContent: "center",
  },
  mono: { fontFamily: "Courier", fontSize: 7.5 },
});

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
      <Link src="https://rsla.io" style={{ color: MUTED, textDecoration: "none" }}>
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
              borderWidth: 1,
              borderColor: highlight ? BLUE : BORDER,
              borderRadius: 6,
              padding: 10,
              marginRight: 8,
              backgroundColor: highlight ? HIGHLIGHT : "#FFFFFF",
            }}
          >
            <Text style={{ fontFamily: "Satoshi", fontWeight: 700, fontSize: 11, color: highlight ? BLUE : SLATE }}>
              {tier.label}
              {isSelected ? "  ✓ Selected" : tier.recommended ? "  · Most Popular" : ""}
            </Text>
            {tier.oneTime ? (
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 4 }}>
                {tier.oneTime.displayString}
              </Text>
            ) : null}
            {tier.recurring ? (
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: tier.oneTime ? 1 : 4 }}>
                {tier.recurring.displayString}
              </Text>
            ) : null}
            <View style={{ marginTop: 6 }}>
              {tier.includes.map((line, i) => (
                <Text key={i} style={{ fontSize: 8.5, marginBottom: 2.5 }}>
                  - {line}
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
}

export interface CertificateInfo {
  referenceId: string;
  versionNumber: number;
  contentHash: string;
  agreementVersion: string;
  sentAt: string;
  completedAt: string;
}

/** Signature block used on the Acceptance page and the MSA execution page. */
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
      <Text style={s.bold}>{signer?.name ?? fallbackName}</Text>
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
        <Image src={logoPath} style={[s.logo, { marginBottom: 54 }]} />
        <Text style={s.h1}>{sections.cover.title}</Text>
        <Text style={[s.para, { color: MUTED }]}>{sections.cover.subtitle}</Text>

        <Text style={s.h2}>At a Glance</Text>
        <Text style={s.para}>{sections.atGlance.intro}</Text>
        <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 6, overflow: "hidden" }}>
          {sections.atGlance.rows.map((row, i) => (
            <View key={i} style={[s.tableRow, i === sections.atGlance.rows.length - 1 ? { borderBottomWidth: 0 } : {}]}>
              <Text style={s.tableLabel}>{row.label}</Text>
              <Text style={s.tableValue}>{row.value}</Text>
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
          <Text key={i} style={i === 0 ? { marginTop: 6 } : s.bold}>
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
        <Text style={s.para}>{sections.trackRecord.intro}</Text>
        {sections.trackRecord.caseStudies.map((cs, i) => (
          <View key={i} style={s.bulletRow} wrap={false}>
            <Text style={s.bulletDot}>•</Text>
            <Link src={cs.href} style={{ flex: 1, color: SLATE, textDecoration: "underline" }}>
              {cs.text}
            </Link>
          </View>
        ))}
        <Text style={s.fine}>{sections.trackRecord.disclaimer}</Text>
        <PageFooter left={footerLeft} />
      </Page>

      {/* Scope + Timeline */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h2}>{sections.scope.heading}</Text>
        <Text style={s.para}>{sections.scope.intro}</Text>
        <Bullets items={sections.scope.items} />
        <Text style={[s.para, { marginTop: 6 }]}>{sections.scope.outro}</Text>
        <Text style={s.fine}>{sections.scope.footnote}</Text>

        <Text style={s.h2}>{sections.timeline.heading}</Text>
        <Text style={s.para}>{sections.timeline.intro}</Text>
        <Bullets items={sections.timeline.items} />
        <Text style={[s.para, { marginTop: 6 }]}>{sections.timeline.outro}</Text>
        <Text style={s.fine}>{sections.timeline.footnote}</Text>
        <PageFooter left={footerLeft} />
      </Page>

      {/* Investment + How to Proceed + Acceptance */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h2}>{sections.investment.heading}</Text>
        <Text style={s.para}>{sections.investment.note}</Text>
        {sections.investment.details
          .split("\n")
          .filter((l) => l.trim())
          .map((line, i) => (
            <Text key={i} style={[s.para, { fontFamily: "Helvetica-Bold", marginBottom: 3 }]}>
              {line}
            </Text>
          ))}
        {sections.investment.tiers ? (
          <TierTable tiers={sections.investment.tiers} selectedTierId={selectedTierId} />
        ) : null}
        <Text style={s.fine}>{sections.investment.footnote}</Text>

        <Text style={s.h2}>{sections.howToProceed.heading}</Text>
        <Text style={s.para}>{sections.howToProceed.intro}</Text>
        {sections.howToProceed.steps.map((step, i) => (
          <View key={i} style={s.bulletRow} wrap={false}>
            <Text style={[s.bulletDot, { width: 18 }]}>{i + 1}.</Text>
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
        <PageFooter left={footerLeft} />
      </Page>

      {/* MSA */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>{sections.msa.heading}</Text>
        <Text style={s.para}>
          Prepared for: <Text style={s.bold}>{sections.msa.preparedFor}</Text>
        </Text>
        {sections.msa.blocks.map((block, i) => {
          if (block.type === "heading") {
            return (
              <Text key={i} style={s.h2}>
                {block.text}
              </Text>
            );
          }
          const runs = block.runs.map((run, j) => (
            <Text key={j} style={run.bold ? s.bold : undefined}>
              {run.text}
            </Text>
          ));
          if (block.type === "bullet") {
            return (
              <View key={i} style={s.bulletRow} wrap={false}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={{ flex: 1 }}>{runs}</Text>
              </View>
            );
          }
          return (
            <Text key={i} style={s.para} wrap={false}>
              {runs}
            </Text>
          );
        })}

        {/* Execution of the agreement itself, mirroring the Acceptance page
            (Section 37: the Acceptance signature executes both documents). */}
        <View
          wrap={false}
          style={{ marginTop: 26, borderTopWidth: 2, borderTopColor: SLATE, paddingTop: 14 }}
        >
          <Text style={[s.bold, { fontSize: 12 }]}>Agreed and Accepted</Text>
          <Text style={[s.para, { marginTop: 4 }]}>
            Executed by electronic signature. Pursuant to Section 37, the signature on the
            Acceptance page of the Proposal executes this Agreement, and is reproduced here as the
            execution of record for both Parties.
          </Text>
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
            <Image src={logoPath} style={{ width: 26, height: 26 }} />
          </View>
          <Text style={[s.certMeta, { marginTop: 2 }]}>Sent on {certificate.sentAt}</Text>

          <View style={s.certHeadRow}>
            <Text style={[s.certLabel, { width: "52%" }]}>Signed by</Text>
            <Text style={[s.certLabel, { width: "48%" }]}>Signature</Text>
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
                {signer.ipAddress ? (
                  <Text style={s.certDetail}>IP address: {signer.ipAddress}</Text>
                ) : null}
              </View>
            </View>
          ))}

          <Text style={[s.para, { marginTop: 16, fontSize: 9.5 }]}>
            Document completed by all parties on{" "}
            <Text style={s.bold}>{certificate.completedAt}</Text>
          </Text>

          <View style={{ marginTop: "auto" }}>
            <Text style={[s.certDetail, { marginTop: 14 }]}>
              Executed electronically under the federal E-SIGN Act, the New York Electronic
              Signatures and Records Act (ESRA), and the Uniform Electronic Transactions Act
              (UETA). Agreement version {certificate.agreementVersion} (document v
              {certificate.versionNumber}).
            </Text>
            <Text style={[s.certDetail, { marginTop: 4 }]}>
              Document integrity — SHA-256 fingerprint of the content frozen at send:
            </Text>
            <Text style={s.mono}>{certificate.contentHash}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
