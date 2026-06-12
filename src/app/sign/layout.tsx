import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Proposal | RSL/A",
};

export default function SignLayout({ children }: { children: React.ReactNode }) {
  return children;
}
