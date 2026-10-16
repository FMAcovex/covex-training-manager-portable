// Test-process preload only. Production code has no simulated identity/provider switch.
import { readFileSync } from "node:fs";
import path from "node:path";

if (!process.env.COVEX_TEST_JWKS || !process.env.COVEX_TEST_OBJECT_ID) throw new Error("Missing synthetic test identity");
const originalFetch = globalThis.fetch;
const models = [...readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8").matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
const lists = new Map([...models, "CovexOperation"].map((model) => [model, new Map()]));
const files = new Map(); const folders = new Map(); const uploads = new Map();
let version = 0;
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const failure = (status, code) => json({ error: { code, message: `Synthetic ${code}` } }, status);
function seed(model, data, key = data.id) {
  lists.get(model).set(data.id, { id: data.id, eTag: `"${++version}"`, fields: {
    Title: data.id, CovexId: data.id, CovexUniqueKey: key, CovexPayload: JSON.stringify(data), CovexUpdatedAt: new Date().toISOString(),
  } });
}
const timestamp = "2026-01-01T00:00:00.000Z";
seed("UserProfile", { id: "synthetic-admin", entraObjectId: process.env.COVEX_TEST_OBJECT_ID, email: "synthetic@example.invalid", displayName: "Administrador sintético", role: "ADMIN", active: true, createdAt: timestamp, updatedAt: timestamp }, process.env.COVEX_TEST_OBJECT_ID);
for (const [model, id, code, name] of [["Department", "quality", "GC", "Calidad sintética"], ["TrainingType", "type", "SYN", "Tipo sintético"], ["Modality", "onsite", "PRE", "Presencial sintética"], ["EvaluationMethod", "test", "TEST", "Test sintético"]]) seed(model, { id, code, name, active: true }, code);
for (const [type, suffix] of [["ANNEX_III", "iii"], ["ANNEX_IV", "iv"], ["ANNEX_V", "v"]]) seed("TemplateVersion", {
  id: `synthetic-template-${suffix}`, annexType: type, procedureCode: "RH-00/003/05", templateVersion: suffix === "iii" ? "TEST-1" : `TEST-${suffix.toUpperCase()}-1`,
  storageProvider: "DEVELOPMENT_FIXTURE", storageReference: `fixture://annex-${suffix}/rh-00-003-05-test-v1`, effectiveFrom: timestamp, active: true, createdAt: timestamp,
});

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  if (url.hostname === "login.microsoftonline.com") return json(JSON.parse(process.env.COVEX_TEST_JWKS));
  if (url.hostname === "synthetic.up.1drv.com") {
    const session = uploads.get(url.pathname); if (!session) return failure(404, "missingUpload");
    const range = new Headers(init.headers).get("content-range");
    const [, start, end, total] = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range) ?? [];
    if (!start || Number(start) !== session.size) return failure(416, "invalidRange");
    const bytes = Buffer.from(init.body); session.parts.push(bytes); session.size += bytes.length;
    if (Number(end) + 1 < Number(total)) return json({ nextExpectedRanges: [`${session.size}-`] }, 202);
    const id = `file-${++version}`; const result = { id, name: session.name, size: session.size, eTag: `"${version}"` };
    files.set(id, { ...result, bytes: Buffer.concat(session.parts) }); return json(result, 201);
  }
  if (url.hostname !== "graph.microsoft.com") return originalFetch(input, init);
  const route = decodeURIComponent(url.pathname.replace(/^\/v1\.0/, ""));
  if (route === "/me") return json({ id: process.env.COVEX_TEST_OBJECT_ID, displayName: "Administrador sintético", mail: "synthetic@example.invalid" });
  if (route === "/sites/synthetic-site/lists") return json({ value: [...lists.keys()].map((model) => ({ id: model, displayName: `COVEX-${model}` })) });
  const items = /^\/sites\/synthetic-site\/lists\/([^/]+)\/items(?:\/([^/]+))?(\/fields)?$/.exec(route);
  if (items) {
    const rows = lists.get(items[1]); if (!rows) return failure(404, "missingList");
    const current = items[2] ? rows.get(items[2]) : undefined;
    if (method === "GET") {
      if (items[2]) return current ? json(current) : failure(404, "missingItem");
      let values = [...rows.values()]; const filter = url.searchParams.get("$filter");
      if (filter) {
        const match = /^fields\/(\w+) eq '(.*)'$/.exec(filter);
        if (!match) return failure(400, "unsupportedFilter");
        values = values.filter((row) => row.fields[match[1]] === match[2].replace(/''/g, "'"));
      }
      return json({ value: values });
    }
    if (method === "POST") {
      const { fields } = JSON.parse(init.body);
      if ([...rows.values()].some((row) => row.fields.CovexId === fields.CovexId || row.fields.CovexUniqueKey === fields.CovexUniqueKey)) return failure(409, "uniqueConflict");
      const row = { id: fields.CovexId, eTag: `"${++version}"`, fields }; rows.set(row.id, row); return json(row, 201);
    }
    if (!current) return failure(404, "missingItem");
    if (new Headers(init.headers).get("if-match") !== current.eTag) return failure(412, "preconditionFailed");
    if (method === "PATCH") { current.fields = JSON.parse(init.body); current.eTag = `"${++version}"`; return json({ ...current.fields, "@odata.etag": current.eTag }); }
    if (method === "DELETE") { rows.delete(current.id); return new Response(null, { status: 204 }); }
  }
  const driveRoot = "/sites/synthetic-site/drives/synthetic-drive";
  if (route.startsWith(`${driveRoot}/`)) {
    const relative = route.slice(driveRoot.length);
    const lookup = /^\/(?:root|items\/([^/:]+)):\/(.*):$/.exec(relative);
    if (lookup && method === "GET") {
      const parent = lookup[1] ? folders.get(lookup[1])?.path : "";
      const folder = [...folders.values()].find((value) => value.path === [parent, lookup[2]].filter(Boolean).join("/"));
      return folder ? json(folder) : failure(404, "missingFolder");
    }
    const children = /^\/(?:root|items\/([^/]+))\/children$/.exec(relative);
    if (children && method === "POST") {
      const { name } = JSON.parse(init.body); const parent = children[1] ? folders.get(children[1])?.path : "";
      const folder = { id: `folder-${++version}`, name, path: [parent, name].filter(Boolean).join("/") }; folders.set(folder.id, folder); return json(folder, 201);
    }
    const upload = /^\/root:\/(.*):\/(content|createUploadSession)$/.exec(relative);
    if (upload) {
      const name = upload[1].split("/").at(-1);
      if (upload[2] === "createUploadSession") { const id = `/upload-${++version}`; uploads.set(id, { name, size: 0, parts: [] }); return json({ uploadUrl: `https://synthetic.up.1drv.com${id}` }); }
      const bytes = Buffer.from(init.body); const result = { id: `file-${++version}`, name, size: bytes.length, eTag: `"${version}"` }; files.set(result.id, { ...result, bytes }); return json(result, 201);
    }
    const file = /^\/items\/([^/]+)(\/content)?$/.exec(relative);
    if (file) {
      const stored = files.get(file[1]); if (!stored) return failure(404, "missingFile");
      if (method === "DELETE") { files.delete(file[1]); return new Response(null, { status: 204 }); }
      return new Response(stored.bytes, { headers: { "Content-Type": "application/octet-stream" } });
    }
  }
  return failure(400, "unsupportedGraphRoute");
};
