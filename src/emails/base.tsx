import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

import { SUPPORT_EMAIL } from "@/lib/constants";

export const brand = {
  blue: "#0070F3",
  slate: "#111827",
  sand: "#F9FAFB",
  border: "#E5E7EB",
  muted: "#6B7280",
};

export { SUPPORT_EMAIL };

// Emails render in external inboxes, so the logo must be an absolute, always-reachable URL — never
// the env-dependent app URL, which is localhost in dev/preview and shows as a broken image. Served
// from the stable prod domain (returns the asset 200).
const EMAIL_LOGO_URL = "https://proposals.rsla.io/logomark.png";

export function EmailShell({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: brand.sand, fontFamily: "Inter, Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto" }}>
          <Section style={{ padding: "0 8px 14px" }}>
            {/* Logomark only — the wordmark has its own letterforms, never
                approximate it with text. */}
            <Img
              src={EMAIL_LOGO_URL}
              alt="RSL/A"
              width={32}
              height={32}
              style={{ borderRadius: "7px", display: "block" }}
            />
          </Section>
          <Section
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              border: `1px solid ${brand.border}`,
              padding: "32px",
            }}
          >
            {children}
          </Section>
          <Section style={{ padding: "16px 8px 0" }}>
            <Text style={{ fontSize: "12px", color: brand.muted, margin: 0, lineHeight: "18px" }}>
              <Link href="https://rsla.io" style={{ color: brand.muted, textDecoration: "underline" }}>
                RSL/A
              </Link>
              <br />
              Questions? Email us at{" "}
              <Link href={`mailto:${SUPPORT_EMAIL}`} style={{ color: brand.muted, textDecoration: "underline" }}>
                {SUPPORT_EMAIL}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: "20px", fontWeight: 700, color: brand.slate, margin: "0 0 16px", lineHeight: "28px" }}>
      {children}
    </Text>
  );
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: "14px", color: "#374151", margin: "0 0 14px", lineHeight: "22px" }}>
      {children}
    </Text>
  );
}

export function CtaButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section style={{ textAlign: "center", padding: "8px 0 16px" }}>
      <Link
        href={href}
        style={{
          display: "inline-block",
          backgroundColor: brand.blue,
          color: "#FFFFFF",
          fontSize: "14px",
          fontWeight: 600,
          padding: "12px 28px",
          borderRadius: "8px",
          textDecoration: "none",
        }}
      >
        {children}
      </Link>
    </Section>
  );
}

export function Divider() {
  return <Hr style={{ borderColor: brand.border, margin: "20px 0" }} />;
}

export function FinePrint({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: "12px", color: brand.muted, margin: "0", lineHeight: "18px" }}>
      {children}
    </Text>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Text style={{ fontSize: "13px", margin: "0 0 6px", lineHeight: "20px" }}>
      <span style={{ color: brand.muted }}>{label}: </span>
      <span style={{ color: brand.slate, fontWeight: 600 }}>{value}</span>
    </Text>
  );
}
