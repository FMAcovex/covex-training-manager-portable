# Flujos funcionales

## WF-01 — Crear formación planificada

1. Usuario pulsa `Nueva formación`.
2. Selecciona `Planificada`.
3. Completa todos los campos mostrados y aplicables; frecuencia y observaciones pueden quedar vacías.
4. El motivo puede quedar vacío.
5. Guarda la Formación.
6. La Formación queda disponible en el Plan del año correspondiente.
7. Puede crear Sesiones inmediatamente o posteriormente.

Resultado: Formación planificada visible en el Plan anual.

## WF-02 — Crear formación no planificada

1. Usuario pulsa `Nueva formación`.
2. Selecciona `No planificada`.
3. El sistema exige `Motivo`.
4. Completa todos los campos mostrados y aplicables; frecuencia y observaciones pueden quedar vacías.
5. Crea al menos una Sesión cuando corresponda.

Resultado: Formación incorporada al ejercicio con origen no planificado.

## WF-03 — Crear Sesión

1. Abrir Formación.
   Si está cerrada documentalmente, reabrirla explícitamente con motivo antes de añadir sesiones (D-066).
2. Pulsar `Añadir sesión`.
3. Indicar fecha prevista, formador y duración.
4. Seleccionar asistentes previstos.
5. El sistema bloquea duplicados.
6. Guardar.

Resultado: Sesión `PENDIENTE`.

## WF-04 — Generar Anexo III antes de impartir

1. Abrir Sesión pendiente.
2. Validar que existen los datos necesarios para el registro.
3. Para formación interna, comprobar que método de evaluación y criterio de aptitud están definidos.
4. Pulsar `Generar Anexo III`.
5. El motor usa la versión de plantilla vigente.
6. Se genera PDF listo para impresión.

La generación no cambia el estado de ejecución.

## WF-05 — Finalizar Sesión

1. Abrir Sesión pendiente.
2. Pulsar `Finalizar sesión`.
3. Confirmar fecha de ejecución.
4. Inicializar, si se desea, asistentes previstos como `ASISTE` + `APTO`.
5. Registrar excepciones: no asistencia, no apto, observaciones.
6. Guardar.
7. La Sesión pasa a `EJECUTADA`.

Los checks documentales pueden estar incompletos.

## WF-06 — Control documental posterior

1. Una persona con rol `RESPONSIBLE` o `ADMIN` abre una Sesión `EXECUTED` o la pantalla Documentación.
2. Marcar cuando corresponda:
   - Anexo III firmado.
   - Contenido/material archivado.
   - Evaluaciones/exámenes archivados.
3. Guardar.
4. Si los tres están marcados: documentación `COMPLETA`.
5. Si falta alguno: documentación `PENDIENTE`.

No modifica el estado de ejecución.

La ausencia de `DocumentControl` en una Sesión ejecutada se presenta como tres controles desmarcados y documentación `PENDIENTE`. Las Sesiones `PENDING` y `NOT_EXECUTED` no aparecen en la cola y no admiten actualización documental. El filtro anual usa `executionDate`. Generar el Anexo III no confirma su firma.

## WF-07 — Formación con múltiples Sesiones

Ejemplo:

- S01 Ejecutada.
- S02 Ejecutada.
- S03 Pendiente.

Estado global de Formación: `PENDIENTE`.

Cuando S03 pasa a Ejecutada:

Estado global de Formación: `EJECUTADA`.

El estado documental global puede mostrarse como resumen, pero no debe alterar el estado de ejecución.

## WF-08 — Formación planificada no ejecutada

1. Administrador/Responsable abre Formación o Sesión correspondiente.
2. Marca `NO_EJECUTADA` según el diseño final del módulo.
3. El sistema exige justificación.
4. La formación permanece en el Plan anual.

## WF-09 — Resultado No Apto

1. Durante finalización, seleccionar `NO_APTO`.
2. Registrar observación/acción posterior cuando corresponda.
3. El registro permanece en el historial individual.
4. Una futura formación de refuerzo/reentrenamiento se registra como nueva Formación/Sesión relacionada si se implementa relación futura.

## WF-10 — Generar Anexo IV

1. Abrir Plan anual.
2. Seleccionar año.
3. Revisar bloques de planificadas y no planificadas.
4. Pulsar `Generar Anexo IV`.
5. Proyectar una fila por Sesión y una provisional para cada Formación planificada sin Sesiones.
6. Incluir en el PDF todas las planificadas y únicamente las no planificadas ejecutadas.
7. Generar documento únicamente con los datos del año seleccionado usando plantilla vigente.
8. Validar el PDF y registrar `GeneratedDocument` solo después de una salida válida.

## WF-11 — Generar Anexo V

1. Abrir ficha de Persona.
2. Seleccionar año.
3. Pulsar `Generar Anexo V`.
4. Generar el resumen individual para esa Persona y año.
5. Incluir únicamente asistencias `ATTENDED`, por el año de `Session.executionDate`, incluidos resultados No Apto.
6. Calcular próxima renovación solo para Apto con frecuencia definida, mediante meses de calendario.
7. Validar el PDF y registrar `GeneratedDocument` solo después de una salida válida.

## WF-12 — Modificar Sesión ejecutada

1. Usuario intenta editar Sesión ejecutada.
2. Si no es Administrador: denegar edición.
3. Si es Administrador: permitir con registro en AuditEvent.

## WF-13 — Personal externo

1. Administrador/usuario autorizado crea Persona.
2. Selecciona `EXTERNO`.
3. Puede indicar empresa y puesto.
4. La Persona externa queda disponible para futuras Sesiones mientras esté activa.

## WF-14 — Baja de Persona

1. Marcar Persona como inactiva.
2. Dejar de mostrarla por defecto en nuevas selecciones.
3. Conservar todas sus asistencias e historial.

## WF-15 — Administración y trazabilidad

1. Un `ADMIN` accede a Usuarios, Catálogos, Plantillas o Auditoría; otros roles son denegados en servidor.
2. Los cambios de perfil protegen email e identificador únicos, `entraObjectId` inmutable y al menos un Administrador activo.
3. Los catálogos referenciados solo pueden desactivarse; su nombre y código históricos se preservan.
4. Las plantillas se registran como metadata. Solo se activan proveedores soportados y ventanas no solapadas por anexo.
5. El servidor confirma el cambio y añade `AuditEvent` de forma atómica cuando corresponde.
6. Auditoría consulta un máximo de 200 eventos por petición, ordenados de más reciente a más antiguo, sin permitir edición ni borrado.

La corrección de una Sesión cerrada produce `CLOSED_SESSION_CORRECTED`. Un cambio real de checks documentales produce `DOCUMENT_CONTROL_UPDATED`; reenviar los mismos valores no crea otro evento.

## WF-16 — Importar la plantilla de formaciones 2026

1. Un `ADMIN` abre `Administración > Importar` y selecciona el `.xlsx`.
2. El servidor valida las hojas `Personal`, `Sesiones` y `Asistencia` sin almacenar el archivo.
3. La previsualización propone correspondencias y muestra los totales, duplicados e incidencias.
4. El Administrador vincula tipos, modalidades, departamentos, personas y formadores, y concreta fechas o resultados ambiguos.
5. `Validar cambios` vuelve a ejecutar todas las reglas. Mientras exista un error no se habilita la confirmación.
6. Al confirmar, el servidor vuelve a analizar el mismo archivo y comprueba los mapeos.
7. PostgreSQL escribe el lote completo en una única transacción y registra `TrainingImportRun` y `TRAINING_IMPORT_COMPLETED`.

Resultado: el histórico queda disponible en Personal, Formaciones y Plan anual. Si falla cualquier escritura no se incorpora ninguna parte del lote. El mismo archivo no puede confirmarse por segunda vez.

## WF-17 — Revisar integridad y pendientes

1. Un `ADMIN` abre `Administración > Revisión de datos`.
2. El servicio consulta Formaciones, Sesiones, Asistencias, Personas, Departamentos y catálogos, incluidos los valores inactivos necesarios para resolver históricos.
3. El sistema recalcula el estado global de cada Formación y aplica únicamente reglas objetivas ya respaldadas por el modelo y las decisiones vigentes.
4. La pantalla muestra totales de Formaciones completas, con avisos y con errores, además del desglose y el listado de incidencias.
5. El Administrador puede filtrar por año, estado, departamento y tipo de incidencia.
6. Cada incidencia abre directamente la Formación o Sesión correspondiente para que el usuario autorizado revise y corrija manualmente el dato.

Resultado: informe de detección actualizado sin escribir, completar ni modificar ningún expediente.
