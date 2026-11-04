import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BC Book Studio — Ekosistem Penerbitan Cerdas",
  description: "Studio produksi buku pendidikan dan literasi berbantuan kecerdasan buatan.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}