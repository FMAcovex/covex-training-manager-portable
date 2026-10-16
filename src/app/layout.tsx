import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "COVEX Training Manager", description: "Gestión interna de formaciones" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }
