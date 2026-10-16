"use client";

import { useCallback, useEffect, useState } from "react";
import type { PersonHistory } from "@/history/types";

const displayDate = (value?: string) => value ? value.split("-").reverse().join("/") : "—";
export default function PersonHistoryClient({ personId }: { personId: string }) {
  const [history, setHistory] = useState<PersonHistory>();
  const [year, setYear] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const load = useCallback(async (selected: string) => { const response = await fetch(`/api/people/${personId}/history${selected ? `?year=${selected}` : ""}`); const result = await response.json(); if (!response.ok) { setError(result.error ?? "No se pudo cargar el historial"); return; } setHistory(result); setError(""); }, [personId]);
  useEffect(() => { void load(year); }, [load, year]);
  async function generate() {
    if (!year) return;
    setGenerating(true);
    try { const response = await fetch(`/api/people/${personId}/annex-v?year=${year}`, { method: "POST" }); if (!response.ok) { const result = await response.json(); setError(result.error ?? "No se pudo generar el Anexo V"); return; } const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = `Anexo_V_Resumen_Individual_${year}.pdf`; link.click(); URL.revokeObjectURL(url); }
    finally { setGenerating(false); }
  }
  if (!history) return <><h1>Ficha individual</h1>{error ? <p className="error">{error}</p> : <p>Cargando…</p>}</>;
  const person = history.person;
  return <><h1>{person.fullName}</h1><p className="muted">Ficha individual e historial de formaciones recibidas.</p><section className="card"><dl className="details-grid"><div><dt>Tipo</dt><dd>{person.personType === "INTERNAL" ? "INTERNO" : "EXTERNO"}</dd></div><div><dt>Estado</dt><dd>{person.active ? "Activo" : "Inactivo"}</dd></div><div><dt>Departamento</dt><dd>{history.department || "—"}</dd></div><div><dt>Puesto</dt><dd>{person.jobTitle}</dd></div><div><dt>Empresa</dt><dd>{person.company || "—"}</dd></div><div><dt>Código</dt><dd>{person.employeeCode || "—"}</dd></div></dl></section><section className="card"><div className="toolbar"><h2>Historial formativo</h2><div className="button-row"><label>Año<select value={year} onChange={(event) => setYear(event.target.value)}><option value="">Todos los años</option>{history.availableYears.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><button disabled={!year || generating} onClick={generate}>{generating ? "Generando…" : "Generar Anexo V"}</button></div></div>{!year && <p className="muted">Selecciona un año concreto para generar el Anexo V.</p>}{error && <p className="error">{error}</p>}<div className="table-scroll"><table><thead><tr><th>Formación</th><th>Fecha</th><th>Tipo</th><th>Material</th><th>Resultado</th><th>Próxima renovación</th><th>Observaciones</th></tr></thead><tbody>{history.rows.map((row) => <tr key={row.attendanceId}><td>{row.trainingName}</td><td>{displayDate(row.executionDate)}</td><td>{row.trainingType || "—"}</td><td>{row.materialReference || "—"}</td><td><span className={`badge ${row.result === "FAIL" ? "result-fail" : ""}`}>{row.result === "PASS" ? "APTO" : "NO APTO"}</span></td><td>{displayDate(row.renewalDate)}</td><td>{row.observations || "—"}</td></tr>)}</tbody></table></div>{history.rows.length === 0 && <p className="muted">No hay formaciones asistidas en el periodo seleccionado.</p>}</section></>;
}
