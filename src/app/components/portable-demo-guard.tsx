"use client";

import { useEffect } from "react";

/** UX only: middleware is the authority and refuses uploads before route parsing. */
export default function PortableDemoGuard() {
  useEffect(() => {
    const disableFiles = () => document.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
      input.disabled = true;
      input.title = "DEMO — DATOS FICTICIOS: no se admiten archivos reales.";
    });
    disableFiles();
    const observer = new MutationObserver(disableFiles);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
