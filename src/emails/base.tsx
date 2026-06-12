import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export const brand = {
  blue: "#0070F3",
  slate: "#111827",
  sand: "#F9FAFB",
  border: "#E5E7EB",
  muted: "#6B7280",
};

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
          <Section style={{ padding: "0 8px 12px" }}>
            <Text style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "0.08em", color: brand.slate, margin: 0 }}>
              RSL/<span style={{ color: brand.blue }}>A</span>
            </Text>
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
              RSL/A LLC · New York ·{" "}
              <Link href="https://rsla.io" style={{ color: brand.muted, textDecoration: "underline" }}>
                rsla.io
              </Link>
              <br />
              Questions? Reply to this email or write to{" "}
              <Link href="mailto:lalia@rsla.io" style={{ color: brand.muted, textDecoration: "underline" }}>
                lalia@rsla.io
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
