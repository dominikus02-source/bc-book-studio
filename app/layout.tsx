import type { Metadata } from "next";
import ThemeShell from "./theme-shell";
import "./globals.css";
import "../components/settings-control.css";
export const metadata: Metadata = {
  title: "BC Book Studio — Ekosistem Penerbitan Cerdas",
  description: "Studio produksi buku pendidikan dan literasi berbantuan kecerdasan buatan.",
};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="id" suppressHydrationWarning><body suppressHydrationWarning><ThemeShell>{children}</ThemeShell></body></html>;
}
