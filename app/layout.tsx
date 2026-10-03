import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Semester — USYD",
  description: "Your assessments and weekly learning, in one semester view.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
