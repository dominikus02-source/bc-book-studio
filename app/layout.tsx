import type {ReactNode} from "react";
import ThemeShell from "./theme-shell";
import "./globals.css";
export const metadata={title:"BC Book Studio | Bahasa Cerdas",description:"Ruang kreatif untuk merancang, menulis, meninjau, dan menerbitkan buku."};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="id" suppressHydrationWarning><body><ThemeShell>{children}</ThemeShell></body></html>}
