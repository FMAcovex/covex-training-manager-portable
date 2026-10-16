# Validación visual del Anexo IV

## Alcance y fuente

El fixture sanitizado `TEST-IV-1` toma como referencia local la hoja `Plan_Formacion` de `Plantilla_Seguimiento_Formaciones_GMP_v2_formato_firma_redisenado.xlsx` y el PNT RH-00/003/05 Rev. 5 (20/04/2026). Los documentos corporativos, sus registros y datos personales no se copian ni se versionan. La comparación humana final con la plantilla controlada y la impresión a escala real quedan pendientes.

## Geometría y tipografía

- A4 apaisado, una página de ancho.
- Márgenes de referencia: 0,236 pulgadas laterales y 0,591 pulgadas superior/inferior.
- Ocho columnas con proporciones `34.332 / 14.332 / 22 / 21 / 25.109 / 29.664 / 43.664 / 29.109`.
- Logo sanitizado del motor común, referencia del PNT a la derecha y pie `X de N`.
- Helvetica/Helvetica-Bold con métricas reales como alternativa portable a Calibri/Arial. No se afirma identidad tipográfica ni geométrica píxel a píxel.

## Mapeo y límites funcionales

Planificadas: Curso, GMP, Interna/Externa, Duración (h), Asistentes/Colectivo, Fecha prevista, Formador/Entidad y Estado. No planificadas: las mismas siete primeras columnas y Motivo; solo se incluyen ejecutadas. Las planificadas no ejecutadas permanecen en la tabla y su justificación completa se lleva a Observaciones.

`FECHA DE EMISIÓN INICIAL` se conserva vacía porque el modelo no ofrece una fuente inequívoca. `Han sido efectivas todas las formaciones: SI / NO` y `FIRMA Y FECHA` siguen siendo áreas manuales. No se calcula el mínimo GMP individual.

## Paginación

Las filas tienen altura dinámica medida por glifos. Al continuar un bloque se repiten título y cabecera; las filas no se cortan. El resumen se coloca al final y sus Observaciones pueden continuar sin truncamiento. No se crean filas ficticias ni páginas vacías.

## Ejemplos reproducibles

Ejecutar `pnpm annex-iv:validate`. Se generan bajo `tmp/annex-iv-validation/`:

- corto: planificadas y una no planificada ejecutada;
- no ejecutada: justificación completa;
- multipágina: 55 planificadas y 12 no planificadas;
- textos largos: W/M, acentos, ñ, colectivo, formador y observaciones extensas.

El validador comprueba `%PDF`, A4 apaisado, número de páginas, conservación de todas las filas y líneas, límites imprimibles, overflow horizontal, referencia RH-00/003/05 y ausencia de páginas vacías.

## Checklist visual pendiente

- [ ] Comparar logo, colores, bordes, textos fijos y proporciones con el original controlado.
- [ ] Confirmar legibilidad de todas las filas y Observaciones.
- [ ] Confirmar `X de N` a la derecha y una sola página de ancho.
- [ ] Confirmar el área manual de eficacia, firma y fecha.
- [ ] Imprimir a escala real y obtener aceptación humana autorizada.
