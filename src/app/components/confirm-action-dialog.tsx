"use client";

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
  if (!open) return null;

  return (
    <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-action-title" aria-describedby="confirm-action-description">
        <h2 id="confirm-action-title">{title}</h2>
        <p id="confirm-action-description">{description}</p>
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
