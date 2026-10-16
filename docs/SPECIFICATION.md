# Especificación funcional — v1.0

## 1. Objetivo

Crear una aplicación web interna que centralice la gestión de la formación de COVEX y permita:

- planificar formaciones por año;
- registrar formaciones no planificadas;
- crear una o varias sesiones por formación;
- seleccionar asistentes internos y externos;
- registrar asistencia y resultado;
- controlar el estado de ejecución;
- controlar por separado la documentación necesaria para archivo;
- consultar el historial formativo de cada persona;
- generar los Anexos III, IV y V a partir de las plantillas aprobadas;
- filtrar y consultar la información sin depender del Excel actual.

## 2. Naturaleza de la aplicación

La aplicación es una herramienta interna de gestión, preparación de registros y consulta. Los anexos generados se imprimen y se gestionan conforme a la operativa interna de COVEX.

No se diseña como sistema de firma electrónica ni como sustituto del registro oficial en papel en la primera versión.

## 3. Conceptos principales

### Formación

Acción formativa global. Puede ser planificada o no planificada y contener una o varias Sesiones.

### Sesión

Impartición concreta de una Formación. Tiene fecha prevista, fecha de ejecución, formador, asistentes, resultados y su propio control documental.

### Asistencia

Relación entre una Persona y una Sesión, con estado de asistencia, resultado y observaciones.

### Plan anual

Vista por año que contiene las formaciones planificadas y las formaciones no planificadas incorporadas durante el ejercicio.

## 4. Datos de Formación

Como mínimo:

- código interno;
- año;
- nombre;
- planificación: `PLANIFICADA` / `NO_PLANIFICADA`;
- tipo de formación;
- motivo;
- condición GMP: sí/no;
- interna/externa;
- modalidad;
- duración prevista;
- material o documento de referencia;
- contenido;
- colectivo objetivo;
- formador previsto;
- método de evaluación;
- criterio de aptitud;
- frecuencia, cuando aplique;
- observaciones;
- estado global calculado;
- creador y fecha de creación.

### Reglas

- El motivo es obligatorio para una formación no planificada.
- El motivo puede estar vacío para una formación planificada.
- En el alta de una nueva formación, todos los campos mostrados y aplicables al tipo de planificación y al origen seleccionados son obligatorios, excepto frecuencia y observaciones. Solo se exige el campo de formador que corresponda al origen interno o externo.
- Si no se informa colectivo objetivo, la aplicación podrá construirlo a partir de los departamentos de los asistentes de las sesiones.
- Una formación puede guardarse inicialmente aunque todavía no tenga todas las sesiones creadas.

## 5. Datos de Sesión

- código interno;
- formación asociada;
- fecha prevista;
- fecha de ejecución;
- formador;
- duración;
- estado de ejecución;
- justificación de no ejecución, si aplica;
- observaciones;
- controles documentales.

### Estados de ejecución

- `PENDIENTE`
- `EJECUTADA`
- `NO_EJECUTADA`

La fecha de ejecución se cumplimenta al finalizar la sesión.

## 6. Estado global de Formación

- Si existe al menos una Sesión prevista no ejecutada, la Formación no puede considerarse ejecutada.
- Una Formación con varias Sesiones pasa a `EJECUTADA` cuando todas las Sesiones previstas están `EJECUTADAS`.
- Las formaciones planificadas que finalmente no se impartan se mantienen visibles con estado `NO_EJECUTADA` y justificación.

## 7. Asistentes

Las personas se seleccionan del maestro de Personal.

Datos mostrados automáticamente:

- nombre;
- tipo interno/externo;
- empresa, si aplica;
- departamento;
- puesto.

Reglas:

- no se permite duplicar una persona en la misma Sesión;
- el personal externo puede guardarse en el maestro de Personal;
- los externos deben estar claramente identificados;
- al finalizar una Sesión, se podrá inicializar a los asistentes previstos como `ASISTE` + `APTO` y modificar únicamente las excepciones.

### Asistencia

Valores mínimos:

- `ASISTE`
- `NO_ASISTE`

### Resultado

Valores mínimos:

- `APTO`
- `NO_APTO`

Un `NO_APTO` debe conservarse en el historial individual y permitir observaciones/acción posterior.

## 8. Evaluación

Para formaciones internas se registrarán:

- método de evaluación;
- criterio de aptitud.

Estos datos deben estar definidos antes de la impartición. Su existencia no equivale al check documental de “evaluaciones archivadas”.

## 9. Control documental

Por cada Sesión:

- Anexo III firmado: sí/no.
- Contenido / presentación / material archivado: sí/no.
- Evaluaciones / exámenes archivados: sí/no.

### Estado documental

- `PENDIENTE` si falta al menos uno de los tres controles.
- `COMPLETA` si los tres están confirmados.

El estado documental no bloquea el estado `EJECUTADA`.

No será obligatorio cargar físicamente los documentos en V1.

## 10. Plan Anual

La aplicación debe separar la información por año.

Vista anual con dos bloques principales:

### Planificadas

Formaciones incorporadas al Plan inicial o añadidas posteriormente como planificadas.

### No planificadas

Formaciones que surgen durante el ejercicio. Deben conservar su motivo.

La aplicación debe permitir generar el Anexo IV del año seleccionado.

Las planificadas no ejecutadas se mantienen en el Plan con estado y justificación.

## 11. Ficha individual

Cada Persona tendrá una ficha con:

- datos personales operativos;
- estado activo/inactivo;
- histórico de formaciones recibidas;
- filtro por año;
- vista de todos los años.

El Anexo V se genera siempre para una combinación `Persona + Año`.

Debe incluir las formaciones correspondientes a esa persona, incluidos resultados `NO_APTO` cuando existan.

## 12. Pantallas

### Inicio

- selector de año;
- planificadas;
- ejecutadas;
- pendientes;
- no planificadas;
- documentación pendiente;
- próximas formaciones;
- últimas sesiones;
- accesos rápidos.

### Formaciones

Listado con filtros por año, planificación, estado, GMP, tipo, departamento, formador y documentación.

### Nueva formación

Formulario de alta y posterior creación de Sesiones.

### Ficha de Formación

Información general, Sesiones, personas formadas, estado, documentación e historial.

### Ficha de Sesión

Datos de sesión, asistentes, resultados, control documental y generación del Anexo III.

### Plan anual

Selector de año, planificadas, no planificadas y generación de Anexo IV.

### Personal

Listado, filtros, ficha individual e impresión de Anexo V.

### Documentación

Vista prioritaria de sesiones con documentación pendiente y detalle de qué falta.

### Administración

Personal, roles, catálogos, plantillas/versiones, configuración y revisión de integridad de datos.

La revisión de datos es exclusivamente informativa: detecta incidencias y pendientes, diferencia errores de avisos y enlaza con la Formación o Sesión para su corrección manual. No modifica expedientes ni completa valores automáticamente.

## 13. Búsquedas y filtros

Como mínimo:

- año;
- formación;
- persona;
- departamento;
- formador;
- planificación;
- GMP/no GMP;
- interna/externa;
- tipo;
- estado de ejecución;
- estado documental;
- fecha o rango de fechas.

## 14. Codificación

Nueva codificación interna, independiente del Excel histórico.

Propuesta inicial:

- Formación: `FOR-YYYY-NNNN`
- Sesión: `FOR-YYYY-NNNN-SNN`

La base de datos usará identificadores técnicos independientes de estos códigos visibles.

## 15. Historial de cambios

Registrar de forma automática acciones relevantes:

- creación;
- edición;
- finalización de Sesión;
- cambios posteriores de una Sesión ejecutada;
- cambio de controles documentales;
- generación de anexos, cuando sea útil;
- usuario y fecha/hora.

## 16. Fuera de alcance de V1

- firma electrónica;
- carga documental obligatoria;
- interpretación de texto libre mediante IA;
- correo automático;
- indicadores avanzados;
- Libro de Formaciones Iniciales;
- sustitución del registro oficial en papel.
