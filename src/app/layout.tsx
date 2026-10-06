import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PREDATOR — Crypto Intelligence",
  description: "PREDATOR crypto screener and signal platform",
  icons: {
    icon: "/predator-logo.png",
    shortcut: "/predator-logo.png",
    apple: "/predator-logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
