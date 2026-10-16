# Modelo de datos inicial

Este modelo es lógico. Los nombres finales de tablas/campos podrán ajustarse durante implementación sin cambiar el comportamiento funcional.

## Person

Representa personal interno o externo reutilizable.

Campos mínimos:

- `id`: UUID.
- `employeeCode`: opcional.
- `fullName`.
- `personType`: `INTERNAL | EXTERNAL`.
- `company`: opcional, especialmente para externos.
- `departmentId`: opcional para externos.
- `jobTitle`.
- `active`: boolean.
- `notes`: opcional.
- `createdAt`.
- `updatedAt`.

Regla: desactivar una Persona nunca elimina su histórico.

## Department

- `id`.
- `code`.
- `name`.
- `active`.

## Training

- `id`: UUID.
- `code`: código visible `FOR-YYYY-NNNN`.
- `year`.
- `name`.
- `planningType`: `PLANNED | UNPLANNED`.
- `trainingTypeId` o catálogo equivalente.
- `reason`: nullable; obligatorio si `UNPLANNED`.
- `isGmp`: boolean.
- `originType`: `INTERNAL | EXTERNAL`.
- `modalityId` o catálogo equivalente.
- `plannedDurationMinutes`.
- `materialReference`.
- `content`.
- `targetGroup`.
- `plannedTrainerPersonId`: nullable.
- `externalTrainerName`: nullable.
- `evaluationMethodId` o texto controlado.
- `aptitudeCriterion`.
- `frequencyMonths`: nullable.
- `notes`: nullable.
- `createdByUserId`.
- `createdAt`.
- `updatedAt`.

El estado global de Training debe derivarse de sus Sesiones; evitar almacenarlo como fuente primaria si puede calcularse de forma fiable.

## TrainingSession

- `id`: UUID.
- `trainingId`.
- `code`: `FOR-YYYY-NNNN-SNN`.
- `plannedDate`.
- `executionDate`: nullable.
- `trainerPersonId`: nullable.
- `externalTrainerName`: nullable.
- `durationMinutes`.
- `executionStatus`: `PENDING | EXECUTED | NOT_EXECUTED`.
- `nonExecutionReason`: nullable.
- `notes`: nullable.
- `createdAt`.
- `updatedAt`.
- `executedAt`: nullable.
- `executedByUserId`: nullable.

## Attendance

Clave única recomendada: `(sessionId, personId)`.

- `id`: UUID.
- `sessionId`.
- `personId`.
- `attendanceStatus`: `EXPECTED | ATTENDED | NOT_ATTENDED`.
- `result`: `PENDING | PASS | FAIL | NOT_APPLICABLE` según necesidad final.
- `notes`: nullable.
- `createdAt`.
- `updatedAt`.

Reglas:

- no duplicar persona dentro de una sesión;
- `FAIL` se conserva y puede llevar observaciones/acción posterior.

## DocumentControl

Relación 1:1 con TrainingSession.

- `id`.
- `sessionId` unique.
- `signedAnnexIII`: boolean.
- `trainingMaterialArchived`: boolean.
- `evaluationEvidenceArchived`: boolean.
- `updatedByUserId`.
- `updatedAt`.

`documentStatus` se calcula:

- `COMPLETE` si los tres flags son true.
- `PENDING` en cualquier otro caso.

No se persiste `documentStatus`. Para una `TrainingSession` `EXECUTED`, la ausencia de fila equivale a los tres flags en `false` y estado `PENDING`. No se crean filas vacías al ejecutar una Sesión: el `upsert` ocurre únicamente al guardar los controles. El control no aplica a Sesiones `PENDING` ni `NOT_EXECUTED`. `GeneratedDocument` de tipo `ANNEX_III` y `signedAnnexIII` son conceptos independientes.

## UserProfile

Representa permisos internos de la aplicación vinculados a identidad Entra.

- `id`.
- `entraObjectId` unique.
- `email`.
- `displayName`.
- `role`: `USER | RESPONSIBLE | ADMIN`.
- `active`.
- `createdAt`.
- `updatedAt`.

## TemplateVersion

- `id`.
- `annexType`: `ANNEX_III | ANNEX_IV | ANNEX_V`.
- `procedureCode`: por ejemplo `RH-00/003/05`.
- `templateVersion`.
- `storageProvider`: inicialmente SharePoint.
- `storageReference`.
- `effectiveFrom`.
- `effectiveTo`: nullable.
- `active`.
- `createdAt`.

No eliminar versiones históricas utilizadas.

## GeneratedDocument

Opcional pero recomendado para trazabilidad técnica.

- `id`.
- `annexType`.
- `templateVersionId`.
- `trainingId`: nullable.
- `sessionId`: nullable.
- `personId`: nullable.
- `year`: nullable.
- `generatedByUserId`.
- `generatedAt`.
- `temporaryStorageReference`: nullable.

No implica que el PDF deba conservarse permanentemente en V1.

Combinaciones válidas implementadas:

- `ANNEX_III`: `sessionId` obligatorio; `personId` y `year` vacíos.
- `ANNEX_IV`: `year` obligatorio; `sessionId` y `personId` vacíos.
- `ANNEX_V`: `personId` y `year` obligatorios; `sessionId` vacío.

La nulabilidad física no sustituye la validación del servicio/repositorio. Las relaciones históricas con Sesión, Persona, Plantilla y Usuario usan borrado restringido cuando corresponde.

## AuditEvent

- `id`.
- `actorUserId`.
- `timestamp`.
- `entityType`.
- `entityId`.
- `action`.
- `beforeJson`: nullable.
- `afterJson`: nullable.
- `contextJson`: nullable.

Es append-only: no existe actualización ni borrado desde la aplicación. `timestamp` y `actorUserId` los establece el servidor. `beforeJson`, `afterJson` y `contextJson` usan JSON nullable, sin contraseñas, tokens, secretos, binarios ni archivos. Índices: `timestamp`, `actorUserId`, `(entityType, entityId)` y `action`.

La relación con `UserProfile` usa borrado restringido. Las operaciones críticas escriben el dato y el evento en la misma transacción.

## TrainingImportRun

- `id`.
- `sourceFingerprint`: SHA-256 único del archivo confirmado.
- `year`: actualmente `2026`.
- `actorUserId`.
- `summaryJson`: recuentos del lote, sin almacenar el archivo ni sus filas.
- `createdAt`.

La fila se crea dentro de la misma transacción que todos los registros importados. Su unicidad hace idempotente la confirmación de un archivo y la relación con `UserProfile` usa borrado restringido.

## Catálogos configurables

Recomendados:

- TrainingType.
- Modality.
- EvaluationMethod.
- Department.

Evitar codificar en componentes listas de negocio que puedan cambiar.

Los cuatro catálogos tienen UUID por defecto, `code` único e inmutable y baja lógica mediante `active`. Un registro referenciado conserva también su nombre histórico. `TemplateVersion` conserva sus campos identificativos y de almacenamiento tras el alta; únicamente se modifican `active`, `effectiveFrom` y `effectiveTo`. Una versión `DEVELOPMENT_FIXTURE` activa debe coincidir en toda su metadata identificativa con una fixture soportada por el motor, no solo en su referencia de almacenamiento.

## Relaciones principales

```text
Training 1 --- N TrainingSession
TrainingSession 1 --- N Attendance
Person 1 --- N Attendance
TrainingSession 1 --- 1 DocumentControl
Department 1 --- N Person
TemplateVersion 1 --- N GeneratedDocument
UserProfile 1 --- N AuditEvent
UserProfile 1 --- N TrainingImportRun
```
