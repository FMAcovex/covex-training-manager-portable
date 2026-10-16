import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "COVEX Training Manager", description: "Gestión interna de formaciones" };
// Authentication and repository provider are runtime choices (H9A/H10B), never build-time fixtures.
export const dynamic = "force-dynamic";
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }
