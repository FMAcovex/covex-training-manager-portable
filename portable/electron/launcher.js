/* global document, window */
const bridge = window.covexDesktop;
const byId = (id) => document.getElementById(id);
let current = null;
let lastSettings = "";
function render(state) {
  current = state;
  byId("version").textContent = state.version;
  byId("status-message").textContent = state.message;
  byId("status-code").textContent = state.code ? `Código para IT: ${state.code}` : "";
  byId("status-panel").dataset.error = String(state.phase === "error");
  byId("status-panel").setAttribute("aria-busy", String(state.busy));
  for (const button of document.querySelectorAll("button")) button.disabled = state.busy;
  byId("start-corporate").disabled = state.busy || !state.configuration || !byId("acknowledge").checked;
  byId("export").disabled = byId("connectivity").disabled = state.busy || !state.configuration;
  byId("retry").hidden = state.phase !== "error" || !state.mode;
  const serialized = JSON.stringify(state.configuration);
  if (state.configuration && serialized !== lastSettings) for (const [key, value] of Object.entries(state.configuration)) { if (byId(key)) byId(key).value = value; }
  lastSettings = serialized;
}
async function invoke(action) {
  byId("feedback").textContent = "";
  try {
    const result = await action();
    if (result.state) render(result.state);
    if (!result.ok) byId("feedback").textContent = result.error;
    else if (typeof result.value === "string") byId("feedback").textContent = result.value;
  } catch { byId("feedback").textContent = "No se pudo comunicar con el lanzador. Cierra COVEX y vuelve a abrir el EXE."; }
}
byId("settings").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = { schemaVersion: 1 };
  for (const key of ["tenantId", "clientId", "siteId", "listPrefix", "driveId", "redirectUri"]) data[key] = byId(key).value;
  void invoke(() => bridge.save(data));
});
byId("start-demo").addEventListener("click", () => void invoke(() => bridge.start("demo", false)));
byId("start-corporate").addEventListener("click", () => void invoke(() => bridge.start("corporate", byId("acknowledge").checked)));
byId("retry").addEventListener("click", () => void invoke(() => bridge.start(current.mode, byId("acknowledge").checked)));
byId("acknowledge").addEventListener("change", () => { if (current) render(current); });
for (const [id, method] of [["import", "importSettings"], ["export", "exportSettings"], ["connectivity", "connectivity"], ["copy-diagnostic", "copyDiagnostic"], ["export-diagnostic", "exportDiagnostic"]]) byId(id).addEventListener("click", () => void invoke(() => bridge[method]()));
if (bridge) { bridge.onState(render); void invoke(() => bridge.state()); }
else byId("status-message").textContent = "Este asistente solo funciona al abrir el ejecutable COVEX portable.";
