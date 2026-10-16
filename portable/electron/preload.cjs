const { contextBridge, ipcRenderer } = require("electron");
// No generic invoke, filesystem, shell, URL or process API crosses this bridge.
contextBridge.exposeInMainWorld("covexDesktop", Object.freeze({
  state: () => ipcRenderer.invoke("covex:state"),
  save: (settings) => ipcRenderer.invoke("covex:save", settings),
  start: (mode, acknowledged) => ipcRenderer.invoke("covex:start", { mode, acknowledged }),
  connectivity: () => ipcRenderer.invoke("covex:connectivity"),
  importSettings: () => ipcRenderer.invoke("covex:import-settings"),
  exportSettings: () => ipcRenderer.invoke("covex:export-settings"),
  copyDiagnostic: () => ipcRenderer.invoke("covex:copy-diagnostic"),
  exportDiagnostic: () => ipcRenderer.invoke("covex:export-diagnostic"),
  onState: (listener) => { const handler = (_event, state) => listener(state); ipcRenderer.on("covex:state-changed", handler); return () => ipcRenderer.removeListener("covex:state-changed", handler); },
}));
