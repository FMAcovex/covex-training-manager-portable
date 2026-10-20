"use client";

import { useEffect, useId, useRef } from "react";

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const options = useRef({ busy, onCancel });
  options.current = { busy, onCancel };
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    const focusable = () => Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'));
    const focusFirst = () => (focusable()[0] ?? element).focus();
    focusFirst();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); if (!options.current.busy) options.current.onCancel(); }
      if (event.key !== "Tab") return;
      const items = focusable();
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (!items.length || (event.shiftKey ? index <= 0 : index === items.length - 1 || index < 0)) {
        event.preventDefault(); (event.shiftKey ? items[items.length - 1] ?? element : items[0] ?? element).focus();
      }
    };
    const focusin = (event: FocusEvent) => { if (!element.contains(event.target as Node)) focusFirst(); };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focusin);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focusin);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  if (!open) return null;

  return (
    <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section ref={dialog} tabIndex={-1} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-description`}>{description}</p>
        <div className="confirm-dialog-actions">
          <button className="secondary" type="button" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
          <button className={tone === "danger" ? "danger" : ""} type="button" disabled={busy} onClick={() => void onConfirm()}>
            {busy ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
