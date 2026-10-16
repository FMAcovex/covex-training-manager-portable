# H10B — resultado técnico y estado de aceptación

## Resultado implementado

H10B incorpora un proveedor `portable-sharepoint` para la aplicación Next.js existente. Las mismas pantallas, validaciones, servicios y reglas de dominio seleccionan adaptadores de Microsoft Graph en lugar de Prisma. El modo servidor H9A (`server-postgres`) y el modo demo permanecen separados y sin cambios de contrato.

La edición portable incluye:

- aplicación local Windows x64 con Electron y servidor Next.js limitado a `127.0.0.1`;
- inicio de sesión Microsoft Entra con MSAL, Authorization Code + PKCE y tenant único;
- sesión local `HttpOnly`, token delegado solo en memoria, validación criptográfica del ID token y comprobación `/me`;
- autorización funcional `USER` / `RESPONSIBLE` / `ADMIN` cargada desde SharePoint, no desde la interfaz;
- persistencia de los 22 modelos Prisma en 22 listas y una lista técnica de operaciones;
- ETag/`If-Match`, claves únicas, índices, paginación y reintentos acotados de consultas 429/503/504; las mutaciones inciertas no se repiten a ciegas;
- reserva optimista de numeración para formaciones y sesiones sin reutilizar números;
- operaciones correlacionadas y bloqueo compartido entre instalaciones; una operación incierta bloquea nuevas escrituras hasta reconciliación;
- biblioteca documental con tamaño y SHA-256 comprobados al recuperar; el transporte admite hasta 250 MB, y la aplicación conserva la política existente de 10 MB por archivo, 20 archivos y 50 MB por colección;
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

Cada lista tiene `CovexId` único, clave funcional única cuando corresponde, campos indexados y payload JSON. La matriz acredita esquema y adaptadores; **no acredita validación corporativa 22/22 ni equivalencia transaccional con PostgreSQL**. Los binarios se archivan en la biblioteca y la lista conserva metadatos, hash y ETag.

## Verificación sin tenant corporativo

- suite completa con datos sintéticos;
- pruebas específicas de los 22 modelos, numeración concurrente, dos escritores/ETag 412, paginación, reintentos, escritura parcial y reconciliación;
- carga documental simple y por bloques con transporte Graph simulado;
- aprovisionamiento en seco de 23 listas;
- compilación Next.js, validación reproducible de Anexos III/IV/V y empaquetado Windows en CI.
- `pnpm portable:smoke`: UI de alta de persona, alta/edición de formación y carga documental; API de sesión/finalización, descarga íntegra, Anexos III/IV/V, rechazo anónimo, desactivación del POC H10A y cierre de sesión. Ejecuta Next.js en `portable-sharepoint` sin `DATABASE_URL`, con identidad sintética RS256 y Graph simulado mediante un preload exclusivo del proceso de prueba. Evidencia en `tmp/portable-smoke/` y artefacto CI `h10b-portable-smoke-synthetic`.
- importación histórica con formador inactivo, agregado completo y huella única; journal segmentado cada 100 targets para importaciones grandes; comprobación exacta del catálogo 22/22 contra Prisma.

Los resultados concretos de CI deben consultarse en la PR H10B. Ninguna prueba simulada constituye una validación del tenant COVEX.

## Estado y limitaciones

El código queda **preparado para revisión y piloto sintético**. H10B no está aceptado funcionalmente con COVEX: la integración real sigue **NO VALIDADA / NO-GO para datos corporativos**. Los bloqueos específicos de permisos delegados, auditoría GMP, consistencia y plantillas se detallan en [`H10B_SECURITY_AND_RECOVERY.md`](H10B_SECURITY_AND_RECOVERY.md), además del piloto de [`H10B_IT_REQUIREMENTS.md`](H10B_IT_REQUIREMENTS.md).

SharePoint no ofrece transacciones multi-lista. Las escrituras se serializan entre instalaciones; la segunda recibe conflicto y debe reintentar explícitamente. Tras fallo parcial se conserva el journal y el bloqueo; no existe expiración ni reparación automática. Las lecturas no tienen aislamiento transaccional. IT debe validar reconciliación y restauración con cortes de red reales.

No se ha modificado el repositorio original ni se ha iniciado H10C. H9A continúa disponible mediante `PERSISTENCE_PROVIDER=server-postgres`.
