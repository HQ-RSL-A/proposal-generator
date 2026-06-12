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

Font.register({
  family: "Satoshi",
  fonts: [
    { src: path.join(fontsDir, "Satoshi-Regular.otf"), fontWeight: 400 },
    { src: path.join(fontsDir, "Satoshi-Medium.otf"), fontWeight: 500 },
    { src: path.join(fontsDir, "Satoshi-Bold.otf"), fontWeight: 700 },
    { src: path.join(fontsDir, "Satoshi-Black.otf"), fontWeight: 900 },
  ],
});

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
  brandmark: { fontFamily: "Satoshi", fontWeight: 900, fontSize: 12, letterSpacing: 1 },
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
  sigGrid: { flexDirection: "row", gap: 18, marginTop: 16 },
  sigCol: { flex: 1, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },
  sigImage: { height: 46, width: 150, objectFit: "contain", objectPosition: "left" },
  sigLine: { fontSize: 9, color: MUTED, marginTop: 2 },
  certBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  mono: { fontFamily: "Courier", fontSize: 8 },
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

function PageFooter({ title }: { title: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{title}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function TierTable({ tiers, selectedTierId }: { tiers: TierConfig[]; selectedTierId: string | null }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
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
                  – {line}
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
  signedAt: string;
  consentedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  signatureDataUri: string | null;
}

export interface CertificateInfo {
  proposalId: string;
  versionNumber: number;
  contentHash: string;
  msaVersionLabel: string;
  msaSha256: string;
  selectedTierLabel: string | null;
  generatedAt: string;
  events: { label: string; at: string }[];
}

export function ProposalPdf({
  sections,
  signers,
  certificate,
}: {
  sections: ProposalSections;
  signers: SignerCertInfo[];
  certificate: CertificateInfo;
}) {
  const client = signers.find((p) => p.role === "CLIENT_SIGNER");
  const admin = signers.find((p) => p.role === "ADMIN_SIGNER");
  const clientSigners = signers.filter((p) => p.role === "CLIENT_SIGNER");
  const footerTitle = `RSL/A — ${sections.cover.title}`;

  return (
    <Document
      title={sections.cover.title}
      author="RSL/A LLC"
      subject="Proposal + Master Services Agreement"
    >
      {/* Cover + At a Glance */}
      <Page size="LETTER" style={s.page}>
        <Text style={[s.brandmark, { marginBottom: 60 }]}>
          RSL/<Text style={{ color: BLUE }}>A</Text>
        </Text>
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
        <PageFooter title={footerTitle} />
      </Page>

      {/* Narrative */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h2}>{sections.problem.title}</Text>
        <Text style={s.para}>{sections.problem.greeting}</Text>
        {sections.problem.paragraphs.map((p, i) => (
          <Text key={i} style={s.para}>
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
          <Text key={i} style={s.para}>
            {p}
          </Text>
        ))}
        <Text style={s.para}>{sections.solution.outro}</Text>

        <Text style={s.h2}>{sections.trackRecord.heading}</Text>
        <Text style={s.para}>{sections.trackRecord.intro}</Text>
        {sections.trackRecord.caseStudies.map((cs, i) => (
          <View key={i} style={s.bulletRow}>
            <Text style={s.bulletDot}>•</Text>
            <Link src={cs.href} style={{ flex: 1, color: SLATE, textDecoration: "underline" }}>
              {cs.text}
            </Link>
          </View>
        ))}
        <Text style={s.fine}>{sections.trackRecord.disclaimer}</Text>
        <PageFooter title={footerTitle} />
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
        <PageFooter title={footerTitle} />
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
          <TierTable tiers={sections.investment.tiers} selectedTierId={certificate.selectedTierLabel ? sections.investment.tiers.find((t) => t.label === certificate.selectedTierLabel)?.id ?? null : null} />
        ) : null}
        <Text style={s.fine}>{sections.investment.footnote}</Text>

        <Text style={s.h2}>{sections.howToProceed.heading}</Text>
        <Text style={s.para}>{sections.howToProceed.intro}</Text>
        {sections.howToProceed.steps.map((step, i) => (
          <View key={i} style={s.bulletRow}>
            <Text style={[s.bulletDot, { width: 18 }]}>{i + 1}.</Text>
            <Text style={{ flex: 1 }}>{step}</Text>
          </View>
        ))}

        <Text style={s.h2}>{sections.acceptance.heading}</Text>
        <Text style={s.para}>{sections.acceptance.text}</Text>
        <View style={s.sigGrid} wrap={false}>
          <View style={s.sigCol}>
            <Text style={s.bold}>{sections.acceptance.clientName}</Text>
            <Text style={s.sigLine}>{sections.acceptance.clientCompany}</Text>
            {client?.signatureDataUri ? (
              <Image src={client.signatureDataUri} style={[s.sigImage, { marginTop: 8 }]} />
            ) : (
              <Text style={[s.sigLine, { marginTop: 24 }]}>Signature: ____________________</Text>
            )}
            <Text style={s.sigLine}>
              {client ? `Signed: ${client.signedAt}` : "Date: ____________________"}
            </Text>
          </View>
          <View style={s.sigCol}>
            <Text style={s.bold}>{sections.acceptance.rslaName}</Text>
            <Text style={s.sigLine}>{sections.acceptance.rslaTitle}</Text>
            {admin?.signatureDataUri ? (
              <Image src={admin.signatureDataUri} style={[s.sigImage, { marginTop: 8 }]} />
            ) : (
              <Text style={[s.sigLine, { marginTop: 24 }]}>Signature: ____________________</Text>
            )}
            <Text style={s.sigLine}>
              {admin ? `Signed: ${admin.signedAt}` : "Date: ____________________"}
            </Text>
          </View>
        </View>
        {clientSigners.length > 1 ? (
          <View style={{ marginTop: 14 }}>
            {clientSigners.slice(1).map((signer, i) => (
              <View key={i} style={[s.sigCol, { marginTop: 10 }]} wrap={false}>
                <Text style={s.bold}>{signer.name}</Text>
                {signer.signatureDataUri ? (
                  <Image src={signer.signatureDataUri} style={[s.sigImage, { marginTop: 8 }]} />
                ) : null}
                <Text style={s.sigLine}>Signed: {signer.signedAt}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <PageFooter title={footerTitle} />
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
              <Text key={i} style={s.h2} minPresenceAhead={40}>
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
              <View key={i} style={s.bulletRow}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={{ flex: 1 }}>{runs}</Text>
              </View>
            );
          }
          return (
            <Text key={i} style={s.para}>
              {runs}
            </Text>
          );
        })}
        <PageFooter title={footerTitle} />
      </Page>

      {/* Signature certificate */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>Signature Certificate</Text>
        <Text style={[s.para, { color: MUTED }]}>
          This certificate documents the electronic execution of the preceding Proposal and Master
          Services Agreement under the federal E-SIGN Act, the New York Electronic Signatures and
          Records Act (ESRA), and the Uniform Electronic Transactions Act (UETA).
        </Text>

        <View style={s.certBox}>
          <Text style={s.bold}>Document</Text>
          <Text style={{ fontSize: 9, marginTop: 4 }}>
            Reference: {certificate.proposalId} (v{certificate.versionNumber})
          </Text>
          <Text style={{ fontSize: 9 }}>
            Content hash (SHA-256, frozen at send): <Text style={s.mono}>{certificate.contentHash}</Text>
          </Text>
          <Text style={{ fontSize: 9 }}>
            Agreement version: {certificate.msaVersionLabel} — MSA SHA-256:{" "}
            <Text style={s.mono}>{certificate.msaSha256}</Text>
          </Text>
          {certificate.selectedTierLabel ? (
            <Text style={{ fontSize: 9 }}>
              Pricing option selected by client: {certificate.selectedTierLabel}
            </Text>
          ) : null}
          <Text style={{ fontSize: 9 }}>Certificate generated: {certificate.generatedAt}</Text>
        </View>

        {signers.map((signer, i) => (
          <View key={i} style={s.certBox} wrap={false}>
            <Text style={s.bold}>
              {signer.name} — {signer.role === "ADMIN_SIGNER" ? "RSL/A LLC" : "Client"}
            </Text>
            <Text style={{ fontSize: 9, marginTop: 3 }}>Email: {signer.email}</Text>
            <Text style={{ fontSize: 9 }}>Signature method: {signer.method}</Text>
            <Text style={{ fontSize: 9 }}>Adopted name: {signer.adoptedName}</Text>
            <Text style={{ fontSize: 9 }}>Signed at: {signer.signedAt}</Text>
            {signer.consentedAt ? (
              <Text style={{ fontSize: 9 }}>
                E-signature consent recorded: {signer.consentedAt}
              </Text>
            ) : null}
            {signer.ipAddress ? (
              <Text style={{ fontSize: 9 }}>IP address: {signer.ipAddress}</Text>
            ) : null}
            {signer.userAgent ? (
              <Text style={{ fontSize: 8, color: MUTED }}>Device: {signer.userAgent}</Text>
            ) : null}
            {signer.signatureDataUri ? (
              <Image src={signer.signatureDataUri} style={[s.sigImage, { marginTop: 6 }]} />
            ) : null}
          </View>
        ))}

        <View style={s.certBox}>
          <Text style={s.bold}>Event log</Text>
          {certificate.events.map((event, i) => (
            <Text key={i} style={{ fontSize: 8.5, marginTop: 2 }}>
              {event.at} — {event.label}
            </Text>
          ))}
        </View>

        <Text style={s.fine}>
          The digital audit trail, including the SHA-256 hash of this PDF, is maintained by RSL/A
          LLC. Document integrity can be verified by recomputing the content hash against the frozen
          document record.
        </Text>
        <PageFooter title={footerTitle} />
      </Page>
    </Document>
  );
}
