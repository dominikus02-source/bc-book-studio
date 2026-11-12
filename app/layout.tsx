import type { Metadata } from "next";
import ThemeShell from "./theme-shell";
import "./globals.css";
import "../components/settings-control.css";
const landingThemeBoot = `(function(){try{if(location.pathname!=="/")return;var stored=localStorage.getItem("bcstudio-theme");var dark=stored==="dark"||(!stored&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=dark?"dark":"light";}catch(e){}})();`;
export const metadata: Metadata = {
  title: "BC Book Studio — Ekosistem Penerbitan Cerdas",
  description: "Studio produksi buku pendidikan dan literasi berbantuan kecerdasan buatan.",
};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="id" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:landingThemeBoot}} /></head><body suppressHydrationWarning><ThemeShell>{children}</ThemeShell></body></html>;
}
