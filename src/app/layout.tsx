import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KP Duty",
  description: "KP operating system for Poly + Keshia",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
