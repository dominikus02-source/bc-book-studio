import type { ReactNode } from "react";
export const metadata = { title: "BC Book Studio", description: "Studio penerbitan buku BahasaCerdas" };
export default function RootLayout({children}:{children:ReactNode}) {return <html lang="id"><body style={{margin:0,fontFamily:"system-ui, sans-serif",background:"#f3f6fc",color:"#14223b"}}>{children}</body></html>}
