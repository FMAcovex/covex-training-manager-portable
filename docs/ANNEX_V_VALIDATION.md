# Validación visual del Anexo V

## Alcance y fuente

El fixture sanitizado `TEST-V-1` toma como referencia local la hoja `Resumen_Individual` de `Plantilla_Seguimiento_Formaciones_GMP_v2_formato_firma_redisenado.xlsx` y el PNT RH-00/003/05 Rev. 5 (20/04/2026). No se versionan el libro, el PNT, registros históricos ni datos personales reales. La comparación humana final con la plantilla controlada queda pendiente.

## Geometría y tipografía

- A4 apaisado, referencia visual cercana al 90 %.
- Márgenes laterales de 0,354 pulgadas y superior/inferior de 0,394 pulgadas.
- Ocho columnas visibles derivadas de las proporciones originales A:G e I: Formación, Fecha, Tipo, Material/Referencia, Estado, Resultado, Próxima renovación y Observaciones.
- La columna técnica H (`ID sesión`) no se imprime.
- Logo sanitizado común, referencia del PNT y pie `X de N`.
- Helvetica/Helvetica-Bold medida por glifos como alternativa portable a Calibri/Arial; no se afirma igualdad píxel a píxel.

## Mapeo y reglas

La cabecera contiene Año, Empleado, Total formaciones asistidas, Departamento y Puesto. Solo se incluyen Asistencias `ATTENDED` del año de `Session.executionDate`. `PASS` se presenta como `APTO`, `FAIL` como `NO APTO`. La próxima renovación solo existe para Apto con frecuencia y se calcula por meses de calendario. Observaciones procede exclusivamente de `Attendance.notes`.

No se imprimen empresa, ID Persona, ID Sesión, código FOR ni otros identificadores técnicos.

## Paginación

La primera página muestra la cabecera completa y la tabla. Las páginas siguientes repiten únicamente el encabezado de tabla. Las filas tienen altura dinámica, no se truncan y no se rellenan con filas vacías. `Responsable de Área de Formación` aparece solo en la última página.

## Ejemplos reproducibles

Ejecutar `pnpm annex-v:validate`. Se generan bajo `tmp/annex-v-validation/`:

- corto: cuatro formaciones;
- no apto: conserva `NO APTO` y observación;
- renovaciones: fechas presentes y vacías según regla;
- multipágina: 35 formaciones;
- textos extremos: W/M, acentos, ñ, materiales y observaciones largos.

El validador comprueba `%PDF`, A4 apaisado, Persona+Año, número y conservación de filas, límites imprimibles, overflow horizontal, referencia RH-00/003/05, ausencia de ID sesión y ubicación final del responsable.

## Checklist visual pendiente

- [ ] Comparar logo, colores, bordes, textos fijos y proporciones con el original controlado.
- [ ] Confirmar visibilidad de Próxima renovación y `NO APTO`.
- [ ] Confirmar que el bloque superior no se repite en páginas posteriores.
- [ ] Confirmar responsable solo al final y `X de N` a la derecha.
- [ ] Imprimir a escala real y obtener aceptación humana autorizada.
