import assert from "node:assert/strict";

/** Regression scenarios run on both standalone Chromium and the extracted Windows EXE. */
export async function runAuditCorrectionFlow(page, origin) {
  const errors = [];
  const onError = (error) => errors.push(error.message);
  page.on("pageerror", onError);
  const peopleRoute = "**/api/people";
  const synthetic = Array.from({ length: 121 }, (_, n) => ({ id: `synthetic-page-${n}`, fullName: `Persona sintética ${n}`, employeeCode: `PAGE-${n}`, personType: "EXTERNAL", company: "Empresa ficticia", jobTitle: "Puesto ficticio", active: n < 120 }));
  await page.route(peopleRoute, (route) => route.request().method() === "GET" ? route.fulfill({ json: synthetic }) : route.continue());
  await page.goto(`${origin}/personal`);
  await page.getByText("121 personas · Página 1 de 3", { exact: true }).waitFor();
  assert.equal(await page.locator("tbody tr").count(), 50);
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page.getByText("121 personas · Página 2 de 3", { exact: true }).waitFor();
  await page.getByLabel("Buscar personal", { exact: true }).fill("PAGE-120");
  await page.getByText("1 personas · Página 1 de 1", { exact: true }).waitFor();
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByLabel("Buscar personal", { exact: true }).fill("");
  await page.getByLabel("Estado del personal", { exact: true }).selectOption("ACTIVE");
  await page.getByText("120 personas · Página 1 de 3", { exact: true }).waitFor();
  const trigger = page.getByRole("button", { name: "Desactivar", exact: true }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).waitFor();
  await page.keyboard.press("Shift+Tab");
  assert(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)), "Focus must stay inside the dialog");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert(await trigger.evaluate((element) => element === document.activeElement), "Restore the initiating control");
  await page.unroute(peopleRoute);

  const trainersRoute = "**/api/trainers?currentOnly=true";
  await page.route(trainersRoute, (route) => route.fulfill({ status: 401, json: { error: "Identidad ficticia caducada" } }));
  await page.goto(`${origin}/formaciones/training-demo-1/sesiones/nueva`);
  await page.locator('form [role="alert"]').filter({ hasText: "La sesión ha caducado" }).waitFor();
  await page.locator('[name="plannedDate"]').fill("2027-03-01");
  assert(await page.getByRole("button", { name: "Crear sesión", exact: true }).isDisabled());
  await page.unroute(trainersRoute);
  await page.getByRole("button", { name: "Recargar opciones", exact: true }).click();
  await page.waitForFunction(() => ![...document.querySelectorAll("button")].find((element) => element.textContent === "Crear sesión")?.disabled);
  assert.equal(await page.locator('[name="plannedDate"]').inputValue(), "2027-03-01");

  const sessionsRoute = "**/api/trainings/training-demo-1/sessions";
  let attempts = 0;
  await page.route(sessionsRoute, (route) => {
    if (route.request().method() === "POST") { attempts++; return route.abort("failed"); }
    return route.continue();
  });
  await page.getByRole("button", { name: "Crear sesión", exact: true }).click();
  await page.locator('form [role="alert"]').filter({ hasText: "no se pudo confirmar el guardado" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Guardando…", exact: true }).count(), 0);
  assert.equal(await page.locator('[name="plannedDate"]').inputValue(), "2027-03-01");
  assert.equal(attempts, 1, "No automatic retry of an uncertain mutation");
  await page.unroute(sessionsRoute);
  await page.route(trainersRoute, (route) => route.fulfill({ json: { error: "Respuesta sintética no válida" } }));
  await page.goto(`${origin}/formaciones/training-demo-1/sesiones/nueva`);
  await page.locator('form [role="alert"]').filter({ hasText: "No se pudieron cargar las opciones" }).waitFor();
  await page.unroute(trainersRoute);
  assert.deepEqual(errors, [], "Handled network/catalog errors must not crash the UI");
  page.off("pageerror", onError);
  console.log("Audit UI regressions passed: filters/pagination, keyboard focus, expired identity, malformed catalog, uncertain save and draft preservation.");
}
