import assert from "node:assert/strict";
import { runAuditCorrectionFlow } from "./audit-correction-flow.mjs";

// Shared acceptance scenario: identical existing UI in Chromium and packaged EXE.
// No test endpoint, alternate form, repository injection or production backdoor.
export async function demoJson(page, url, method = "GET", body) {
  return page.evaluate(async ({ url, method, body }) => {
    const response = await fetch(url, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }, { url, method, body });
}

async function saved(page, method, suffix, status, click) {
  const response = page.waitForResponse((item) => new URL(item.url()).pathname === suffix && item.request().method() === method);
  await click();
  const result = await response;
  assert.equal(result.status(), status, `${method} ${suffix}: ${await result.text()}`);
  return result.json();
}

export async function runInteractiveDemoFlow(page, origin, downloadPDF) {
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(60_000);
  const errors = [];
  const onError = (error) => errors.push(error.message);
  page.on("pageerror", onError);
  const before = {};
  for (const resource of ["people", "trainings"]) {
    const response = await demoJson(page, `/api/${resource}`);
    assert.equal(response.status, 200);
    before[resource] = response.data;
  }
  before.sessions = {};
  for (const training of before.trainings) before.sessions[training.id] = (await demoJson(page, `/api/trainings/${training.id}/sessions`)).data;
  await page.goto(`${origin}/personal`);
  await page.locator('[name="fullName"]').fill("Asistente ficticio H10D");
  await page.locator('[name="employeeCode"]').fill("SYN-H10D-001");
  await page.locator('[name="departmentId"]').selectOption("quality");
  await page.locator('[name="jobTitle"]').fill("Puesto ficticio");
  const person = await saved(page, "POST", "/api/people", 201, () => page.getByRole("button", { name: "Añadir persona", exact: true }).click());
  console.log("Interactive demo: synthetic person created");

  await page.goto(`${origin}/formaciones/nueva`);
  // Existing client-side validation must still reject an incomplete form.
  await page.getByRole("button", { name: "Crear formación", exact: true }).click();
  await page.locator(".training-form").getByRole("alert").waitFor();
  await page.locator('[name="year"]').fill("2027");
  await page.locator('[name="name"]').fill("Formacion ficticia H10D");
  await page.locator('[name="planningType"]').selectOption("PLANNED");
  await page.locator('[name="trainingTypeId"]').selectOption("type-initial");
  // Internal course proves the qualified-trainer selection is still enforced.
  await page.getByRole("button", { name: "Seleccionar formadores cualificados", exact: true }).click();
  await page.locator("#plannedTrainerPersonIds-options").getByRole("checkbox", { name: /Persona Demo Calidad/ }).check();
  await page.locator("#plannedTrainerPersonIds-options").getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.locator('[name="modalityId"]').selectOption("mod-in-person");
  for (const [name, value] of Object.entries({ plannedDurationMinutes: "60", materialReference: "SYN-H10D-REF", content: "Contenido exclusivamente ficticio H10D", targetGroup: "Grupo ficticio", aptitudeCriterion: "Superar prueba ficticia" })) await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name="evaluationMethodId"]').selectOption("eval-test");
  const training = await saved(page, "POST", "/api/trainings", 201, () => page.getByRole("button", { name: "Crear formación", exact: true }).click());
  console.log("Interactive demo: training created");
  await page.waitForURL(`**/formaciones/${training.id}`);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.locator('[name="name"]').fill("Formacion ficticia H10D revisada");
  await saved(page, "PATCH", `/api/trainings/${training.id}`, 200, () => page.getByRole("button", { name: "Guardar cambios", exact: true }).click());
  await page.getByRole("link", { name: "Añadir sesión", exact: true }).click();
  await page.locator('[name="plannedDate"]').fill("2027-01-12");
  await page.locator('[name="durationMinutes"]').fill("60");
  await page.getByRole("button", { name: "Seleccionar asistentes", exact: true }).click();
  await page.locator("#attendeePersonIds-options").getByRole("checkbox", { name: /Asistente ficticio H10D/ }).check();
  await page.locator("#attendeePersonIds-options").getByRole("button", { name: "Cerrar", exact: true }).click();
  const session = await saved(page, "POST", `/api/trainings/${training.id}/sessions`, 201, () => page.getByRole("button", { name: "Crear sesión", exact: true }).click());
  console.log("Interactive demo: session created");
  await page.waitForURL(`**/sesiones/${session.id}`);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.locator('[name="durationMinutes"]').fill("90");
  const picker = page.locator(".multi-select-adder").filter({ has: page.locator('[aria-controls="attendeePersonIds-options"]') });
  await picker.locator(".multi-select-trigger").click();
  await page.locator("#attendeePersonIds-options").getByRole("checkbox", { name: /Persona Demo Calidad/ }).check();
  await page.locator("#attendeePersonIds-options").getByRole("button", { name: "Cerrar", exact: true }).click();
  const edited = await saved(page, "PATCH", `/api/sessions/${session.id}`, 200, () => page.getByRole("button", { name: "Guardar cambios", exact: true }).click());
  assert.equal(edited.durationMinutes, 90); assert.equal(edited.attendances.length, 2);
  // Duplicate assistants and invalid completions must be rejected server-side too.
  const invalidSession = { trainingId: training.id, plannedDate: "2027-01-12", trainerPersonIds: ["demo-1"], durationMinutes: 90, attendeePersonIds: [person.id, person.id], expectedUpdatedAt: edited.updatedAt };
  assert.equal((await demoJson(page, `/api/sessions/${session.id}`, "PATCH", invalidSession)).status, 400);
  assert.equal((await demoJson(page, `/api/sessions/${session.id}/finalize`, "POST", { executionDate: "2027-01-12", initializeDefaults: false, attendances: [] })).status, 400);

  async function finalize(corrected = false) {
    await page.getByRole("button", { name: "Preparar cierre", exact: true }).click();
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Guardar y finalizar", exact: true }) });
    await form.locator('input[type="date"]').fill("2027-01-12");
    const fictional = form.getByRole("row").filter({ hasText: "Asistente ficticio H10D" });
    await fictional.locator("select").nth(1).selectOption(corrected ? "PASS" : "FAIL");
    await fictional.locator("input").fill(corrected ? "Correccion ficticia" : "Refuerzo ficticio");
    const absent = form.getByRole("row").filter({ hasText: "Persona Demo Calidad" });
    await absent.locator("select").first().selectOption("NOT_ATTENDED");
    await page.getByRole("button", { name: "Guardar y finalizar", exact: true }).click();
    return saved(page, "POST", `/api/sessions/${session.id}/finalize`, 200, () => page.getByRole("dialog").getByRole("button", { name: "Finalizar sesión", exact: true }).click());
  }
  const executed = await finalize();
  console.log("Interactive demo: attendance and results saved");
  assert.equal(executed.executionStatus, "EXECUTED");
  assert.deepEqual(executed.attendances.map(({ result }) => result), ["FAIL", "NOT_APPLICABLE"]);
  await page.getByLabel("Motivo de reapertura *", { exact: true }).fill("Correccion de resultado ficticio H10D");
  await page.getByRole("button", { name: "Reabrir sesión", exact: true }).click();
  await saved(page, "POST", `/api/sessions/${session.id}/reopen`, 200, () => page.getByRole("dialog").getByRole("button", { name: "Reabrir sesión", exact: true }).click());
  const corrected = await finalize(true);
  assert.deepEqual(corrected.attendances.map(({ result }) => result), ["PASS", "NOT_APPLICABLE"]);
  await page.reload();
  await page.getByRole("button", { name: "Generar Anexo III", exact: true }).waitFor();
  // Actual UI download, not just a successful POST or a fabricated fixture.
  const { bytes: pdf, filename } = await downloadPDF(page);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  // The approved template identifies the course/date, not the session code in
  // its fixed layout. The existing download filename carries the session code.
  assert(filename.includes(session.code), "Download must identify the newly created session");
  const pdfText = [...pdf.toString("latin1").matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((match) => match[1].replace(/\\([\\()])/g, "$1")).join(" ");
  assert(pdfText.includes("Asistente ficticio H10D"), "PDF must contain the synthetic attendee");
  assert(pdfText.includes("Formacion ficticia H10D revisada"), "PDF must use edited training, including wrapped lines");
  assert(pdfText.includes("12/01/2027"), "PDF must use the session execution date");
  const persistedInRam = await demoJson(page, `/api/sessions/${session.id}`);
  assert.equal(persistedInRam.status, 200); assert.equal(persistedInRam.data.durationMinutes, 90);
  assert.deepEqual(errors, [], "No uncaught UI errors");
  page.off("pageerror", onError);
  await runAuditCorrectionFlow(page, origin);
  return { before, person, training, session, pdfBytes: pdf.length };
}

export async function assertDemoReset(page, state) {
  for (const resource of ["people", "trainings"]) {
    const response = await demoJson(page, `/api/${resource}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.data, state.before[resource], `${resource}: restart must restore exactly the synthetic seed`);
  }
  for (const [id, sessions] of Object.entries(state.before.sessions)) assert.deepEqual((await demoJson(page, `/api/trainings/${id}/sessions`)).data, sessions, "Session seed must be restored");
  for (const [resource, id] of [["trainings", state.training.id], ["sessions", state.session.id]]) assert.equal((await demoJson(page, `/api/${resource}/${id}`)).status, 404, `New ${resource} must disappear after restart`);
}
