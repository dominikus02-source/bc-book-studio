"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import ThemeControl from "@/components/theme-control";

export default function ThemeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Landing and dashboard own their in-flow header control. Other routes get a rail,
  // never a floating button over a form, reader page or editor control.
  const ownHeader = pathname === "/" || pathname === "/studio";
  return <>{!ownHeader && <div className="theme-rail"><ThemeControl /></div>}{children}</>;
}
