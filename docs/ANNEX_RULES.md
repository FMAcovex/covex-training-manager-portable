# Reglas de generación de anexos

## Principio general

Los Anexos III, IV y V son plantillas controladas. El sistema debe rellenar las plantillas vigentes y producir documentos de salida sin rediseñar su estructura visual aprobada.

## Versionado

Cada generación debe asociarse a una `TemplateVersion`.

Una actualización futura del PNT o de un Anexo:

- crea una nueva versión de plantilla;
- no modifica plantillas históricas;
- no reinterpreta documentos ya generados;
- permite mantener trazabilidad de la versión usada.

## Elementos visuales protegidos

No alterar salvo cambio aprobado de plantilla:

- colores;
- tipos de letra;
- color de letra;
- bordes;
- textos fijos;
- identificación `Anexo III`, `Anexo IV`, `Anexo V`;
- referencia de PNT;
- distribución de secciones;
- orientación y proporciones generales de impresión.

## Anexo III — Registro de asistencia y evaluación

### Fuente de datos

Sesión + Formación + Asistencias.

### Debe incluir, según plantilla vigente

- fecha;
- nombre de formación;
- formador;
- material/documento de referencia;
- tipo;
- modalidad;
- motivo cuando corresponda;
- colectivo objetivo;
- contenido;
- asistentes;
- departamento y puesto cuando aplique;
- espacio de firma;
- resultado de evaluación según operativa de la plantilla.

### Reglas de presentación acordadas

- Una sola página de ancho.
- Puede ocupar varias páginas en vertical.
- Ajustar altura de las filas de asistentes para que ningún texto quede cortado.
- No mostrar filas vacías innecesarias.
- No eliminar contenido fijo de la plantilla.
- El bloque de `Contenido de la formación` debe conservar todos sus bordes, incluido el borde derecho.
- Debe ser visible la identificación `Anexo III` y la referencia del PNT vigente.
- Si un dato obligatorio para generar correctamente el registro no existe, devolver una validación clara en lugar de producir silenciosamente un documento incompleto.

## Anexo IV — Plan de Formación Anual

### Fuente de datos

Formaciones del año seleccionado y sus estados/sesiones según reglas del Plan.

### Estructura funcional

- Bloque de formaciones planificadas.
- Bloque de formaciones no planificadas incorporadas durante el ejercicio según plantilla vigente.
- Mantener planificadas no ejecutadas con estado/observaciones correspondientes.

### Reglas

- Generar siempre para un año concreto.
- No alterar manualmente el orden mediante lógica visual improvisada; definir un criterio estable de orden en backend.
- No omitir formaciones pendientes o no ejecutadas que deban formar parte del Plan.
- No confundir documentación pendiente con ejecución pendiente.
- Ajustar filas al contenido para evitar cortes y filas vacías innecesarias.
- Cada Sesión produce una fila; una Formación planificada sin Sesiones produce una única fila provisional, que desaparece cuando se crea la primera Sesión.
- El bloque no planificado del PDF incluye solo Sesiones `EXECUTED`; la interfaz conserva pendientes y no ejecutadas.
- Las justificaciones planificadas `NOT_EXECUTED` se imprimen completas en `OBSERVACIONES`, sin añadir columnas a la tabla controlada.
- Se usa A4 apaisado, una página de ancho, columnas proporcionales A:H y pie `X de N`. Títulos y cabeceras se repiten al paginar; el resumen aparece únicamente al final.
- `FECHA DE EMISIÓN INICIAL` permanece visible y vacía mientras no exista una fuente empresarial inequívoca. La eficacia global y la firma siguen siendo manuales.

## Anexo V — Resumen Individual de Formaciones

### Fuente de datos

Persona + año seleccionado + asistencias/formaciones correspondientes.

### Reglas

- Generar siempre para `Persona + Año`.
- Incluir resultados `NO_APTO` cuando existan.
- Puede ocupar varias páginas.
- En la plantilla actual, cuando exista paginación, repetir únicamente el encabezado de tabla equivalente a la fila 11; no repetir innecesariamente el bloque superior completo.
- Ajustar alturas para que el texto no quede cortado.
- Evitar filas vacías innecesarias.
- La fuente incluye únicamente `Attendance.attendanceStatus = ATTENDED`; el año procede de `Session.executionDate`.
- `PASS` se presenta como `APTO`, `FAIL` como `NO APTO`, y la renovación solo se calcula para `PASS` con frecuencia.
- Las columnas visibles son Formación, Fecha, Tipo, Material/Referencia, Estado, Resultado, Próxima renovación y Observaciones. El ID de Sesión no se imprime.
- Se usa A4 apaisado y pie `X de N`. En páginas posteriores solo se repite el encabezado de tabla; `Responsable de Área de Formación` aparece únicamente en la última.

## Implementación técnica

El motor de anexos debe estar aislado en un módulo propio. No mezclar lógica de negocio con coordenadas de celdas o detalles de plantilla.

Recomendación de capas:

1. `AnnexDataBuilder`: transforma entidades del dominio en un modelo de documento.
2. `TemplateAdapter`: conoce las coordenadas/controles de una versión concreta de plantilla.
3. `DocumentRenderer`: genera archivo intermedio.
4. `PdfConverter`: convierte a PDF.
5. `DocumentValidator`: comprueba que la salida contiene elementos esenciales.

Una nueva plantilla debería requerir un nuevo adaptador/configuración, no cambios en las reglas de negocio.

## Datos temporales

Los archivos de trabajo usados para generar PDFs deben ser temporales y no crear dependencia de almacenamiento local del usuario.
