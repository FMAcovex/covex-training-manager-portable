# Validación visual del Anexo III

## Alcance

El Hito 3 utiliza el fixture sanitizado `RH-00/003/05-TEST-1`, derivado únicamente de la estructura, geometría, textos fijos, colores y logotipo de la hoja `Formato_Firma` del archivo local `Plantilla_Seguimiento_Formaciones_GMP_v2_formato_firma_redisenado.xlsx`. No se ha copiado el libro, otras hojas, registros históricos ni datos personales al repositorio. La comparación final con la plantilla controlada definitiva debe realizarla una persona autorizada antes de considerar aprobado el diseño.

El fixture reproduce A4 vertical, márgenes de 0,35 pulgadas a izquierda/derecha y 0,45 pulgadas arriba/abajo, proporciones de columnas `16 / 32 / 21 / 28 / 25 / 18`, distribución de bloques, colores, bordes y alternancia de filas. El logotipo se conserva como recurso JPEG sanitizado y se escala manteniendo su relación de aspecto.

La referencia usa Calibri. El renderer cloud no incorpora esa fuente propietaria: utiliza Helvetica/Helvetica-Bold, fuentes PDF estándar legalmente distribuibles, con tamaños, pesos y geometría ajustados a la referencia. Por ello no se afirma coincidencia tipográfica o geométrica píxel a píxel.

Los ejemplos reproducibles se generan con:

```text
pnpm annex-iii:validate
```

El script crea cuatro PDF ficticios en `tmp/annex-iii-validation`: corto (3 asistentes), textos largos, multipágina y extremo (texto ancho W/M, contenido muy largo y 20 líneas de observaciones). `tmp/` está ignorado y los PDF no deben versionarse.

## Checklist

- [ ] Se ve `Anexo III del PNT Nº RH-00/003/05`.
- [ ] El título es `REGISTRO DE ASISTENCIA Y EVALUACIÓN DE SESIÓN FORMATIVA`.
- [ ] El logo COVEX aparece en la esquina superior izquierda sin deformación y la referencia ocupa su zona superior, no una banda nueva de ancho completo.
- [ ] El documento ocupa una sola página de ancho.
- [ ] Los campos superiores son legibles y no incluyen el código interno de Sesión.
- [ ] El bloque `CONTENIDO DE LA FORMACIÓN` conserva sus cuatro bordes, incluido el derecho.
- [ ] La tabla contiene solo `Nº`, `Empleado`, `Departamento`, `Puesto`, `Firma` y `Apto /No Apto`.
- [ ] Todas las celdas de firma están vacías.
- [ ] Los resultados muestran únicamente `APTO`, `NO APTO` o vacío según corresponda.
- [ ] No aparecen filas vacías innecesarias.
- [ ] Ningún nombre, departamento, puesto o contenido queda cortado.
- [ ] La fecha se muestra como `dd/mm/yyyy`.
- [ ] La cabecera de asistentes reaparece en páginas adicionales.
- [ ] La numeración continúa sin saltos entre páginas.
- [ ] Un caso normal de 16 asistentes ocupa una página; si el pie pasa a otra página, lo acompaña al menos una fila de asistente.
- [ ] Las observaciones generales son visibles en la última página.
- [ ] Solo la celda superior izquierda de `Observaciones:` usa fondo teal; la celda inferior izquierda permanece sin esa banda.
- [ ] La zona `Formador / responsable` queda disponible para registro manual.
- [ ] El contador usa `X de N`, alineado a la derecha y sin el prefijo `Página`.
- [ ] No se crean páginas en blanco.
- [ ] No aparecen datos personales reales ni textos técnicos internos.

## Evidencia automática

La suite y el script comprueban cabecera PDF, tamaño A4, número de páginas, recuento y numeración de asistentes, caso base de 16 filas en una página, ausencia de páginas de asistentes vacías causadas por el pie, distribución completa de contenido y observaciones, medición de líneas con métricas Helvetica (incluidos W/M y caracteres españoles), límites de todas las regiones respecto al área imprimible, textos fijos, referencia del PNT y ausencia de filas ficticias. El cuarto ejemplo falla si detecta overflow o truncamiento. No se realiza OCR ni comparación píxel a píxel.

## Revisión pendiente

Antes de aceptar el Hito 3 se requiere una comparación visual humana de los cuatro ejemplos con la plantilla corporativa controlada, incluida la impresión a escala real. La aplicación no depende de Office, COM ni LibreOffice.
