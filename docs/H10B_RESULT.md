# H10B — resultado técnico y estado de aceptación

## Resultado implementado

H10B incorpora un proveedor `portable-sharepoint` para la aplicación Next.js existente. Las mismas pantallas, validaciones, servicios y reglas de dominio seleccionan adaptadores de Microsoft Graph en lugar de Prisma. El modo servidor H9A (`server-postgres`) y el modo demo permanecen separados y sin cambios de contrato.

La edición portable incluye:

- aplicación local Windows x64 con Electron y servidor Next.js limitado a `127.0.0.1`;
- inicio de sesión Microsoft Entra con MSAL, Authorization Code + PKCE y tenant único;
- sesión local `HttpOnly`, token delegado solo en memoria, validación criptográfica del ID token y comprobación `/me`;
- autorización funcional `USER` / `RESPONSIBLE` / `ADMIN` cargada desde SharePoint, no desde la interfaz;
- persistencia de los 22 modelos Prisma en 22 listas y una lista técnica de operaciones;
- ETag/`If-Match`, claves únicas, índices, paginación, reintentos 429/503/504 y límites de seguridad;
- reserva optimista de numeración para formaciones y sesiones sin reutilizar números;
- operaciones correlacionadas con estados `PREPARING`, `RUNNING`, `COMMITTED`, `ABORTED` y `NEEDS_RECONCILIATION`;
- biblioteca documental para evidencias y documentos de formadores, carga simple o por bloques hasta 250 MB, sin sobrescritura silenciosa;
- auditoría, importación, formadores cualificados, control documental, Anexos III/IV/V e integridad conservados mediante los repositorios existentes;
- aprovisionamiento idempotente y modo `--dry-run`.

## Cobertura 22/22

| Área | Modelos SharePoint |
|---|---|
| Personas y acceso | `Person`, `Department`, `UserProfile` |
| Catálogos | `TrainingType`, `Modality`, `EvaluationMethod` |
| Formaciones | `Training`, `TrainingPlannedTrainer`, `TrainingTargetDepartment`, `TrainingCodeSequence` |
| Sesiones | `TrainingSession`, `TrainingSessionTrainer`, `Attendance`, `SessionCodeSequence` |
| Documentación | `DocumentControl`, `DocumentControlAttachment`, `TemplateVersion`, `GeneratedDocument` |
| Trazabilidad | `AuditEvent`, `TrainingImportRun` |
| Formadores | `TrainerQualification`, `TrainerDocument` |

Cada lista tiene `CovexId` único, clave funcional única cuando corresponde, campos indexados de relación/año/estado/correlación y un payload JSON versionable. Los binarios no se guardan en listas: se archivan en la biblioteca y la lista conserva sus metadatos y ETag.

## Verificación sin tenant corporativo

- suite completa con datos sintéticos;
- pruebas específicas de los 22 modelos, numeración concurrente, dos escritores/ETag 412, paginación, reintentos, escritura parcial y reconciliación;
- carga documental simple y por bloques con transporte Graph simulado;
- aprovisionamiento en seco de 23 listas;
- compilación Next.js, validación reproducible de Anexos III/IV/V y empaquetado Windows en CI.

Los resultados concretos de CI deben consultarse en la PR H10B. Ninguna prueba simulada constituye una validación del tenant COVEX.

## Estado y limitaciones

El código queda **preparado para piloto**, pero la integración real sigue **NO VALIDADA / NO-GO para datos corporativos** hasta ejecutar [`H10B_IT_REQUIREMENTS.md`](H10B_IT_REQUIREMENTS.md). En particular faltan consentimiento y concesión `Sites.Selected`, aprovisionamiento real, perfil ADMIN inicial, prueba con dos usuarios, políticas de retención/DLP/antivirus, copia y restauración, y aceptación GMP.

SharePoint no ofrece transacciones multi-lista. H10B reduce ese riesgo con idempotencia, compensación y registro de operaciones; una operación `NEEDS_RECONCILIATION` exige revisión antes de continuar. IT debe validar este comportamiento con cortes de red reales y el procedimiento operativo propuesto.

No se ha modificado el repositorio original ni se ha iniciado H10C. H9A continúa disponible mediante `PERSISTENCE_PROVIDER=server-postgres`.
