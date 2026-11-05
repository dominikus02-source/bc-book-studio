import type { ReactNode } from "react";
import "./globals.css";
export const metadata = { title: "BC Book Studio | Dari Inspirasi Menjadi Karya", description: "Studio kreatif Bahasa Cerdas untuk menyusun, mengembangkan, meninjau, dan menerbitkan buku pembelajaran." };
export default function RootLayout({children}:{children:ReactNode}) {return <html lang="id"><body>{children}</body></html>}
