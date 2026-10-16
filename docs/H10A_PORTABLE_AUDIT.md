# H10A — auditoría de portabilidad de datos

## Alcance

Esta auditoría se realizó sobre el snapshot exacto `b2414e3f7f702e0bd896a32e67b4e5fcd82789a4`. H10A es una prueba vertical: valida ejecución local Windows, identidad delegada y operaciones básicas de Formación y documentos sobre Microsoft 365. No declara una migración integral de PostgreSQL a SharePoint y no inicia H10B.

## Inventario de los 22 modelos Prisma

| Modelo | Responsabilidad | Dependencia PostgreSQL relevante | Tratamiento H10A |
|---|---|---|---|
| `Person` | Personas internas/externas | UUID, unicidad, relaciones e histórico | Sin migrar |
| `Department` | Departamentos | Código único y referencias restrictivas | Sin migrar |
| `UserProfile` | Identidad y roles | Unicidad Entra/email y relaciones de auditoría | MSAL autentica, pero los roles siguen fuera del POC |
| `TrainingType` | Catálogo de tipo | Integridad referencial y baja lógica | Sin migrar |
| `Modality` | Catálogo de modalidad | Integridad referencial y baja lógica | Sin migrar |
| `EvaluationMethod` | Catálogo de evaluación | Integridad referencial y baja lógica | Sin migrar |
| `Training` | Formación | Código único, arrays, índices, relaciones y cierre | CRUD vertical de siete campos en SharePoint List |
| `TrainingPlannedTrainer` | N:M formación/formador | Clave compuesta y borrado/restricción | Sin migrar |
| `TrainingTargetDepartment` | N:M formación/departamento | Clave compuesta y borrado/restricción | Sin migrar |
| `TrainingCodeSequence` | Numeración anual | Incremento transaccional por año | Sin migrar; el POC recibe un código explícito |
| `TrainingSession` | Sesiones | Fechas SQL, estados, relaciones y transiciones | Sin migrar |
| `TrainingSessionTrainer` | N:M sesión/formador | Clave compuesta y borrado/restricción | Sin migrar |
| `DocumentControl` | Control documental de sesión | Relación 1:1, responsable y actualización atómica | Sin migrar |
| `DocumentControlAttachment` | Evidencias binarias | `Bytes`, metadatos y borrado en cascada | Solo se valida archivo independiente en biblioteca |
| `Attendance` | Asistencia/resultados | Unicidad sesión/persona y transiciones | Sin migrar |
| `SessionCodeSequence` | Numeración de sesión | Incremento transaccional por formación | Sin migrar |
| `TemplateVersion` | Versiones de plantilla | Ventanas de vigencia y unicidad compuesta | Sin migrar |
| `GeneratedDocument` | Trazabilidad de anexos | Varias referencias restrictivas e índices | Sin migrar |
| `AuditEvent` | Auditoría append-only | Escritura en la misma transacción que el cambio | Sin migrar |
| `TrainingImportRun` | Importaciones idempotentes | Huella única y transacción masiva | Sin migrar |
| `TrainerQualification` | Cualificaciones | Unicidad compuesta, fechas y anulación | Sin migrar |
| `TrainerDocument` | Evidencias de formador | `Bytes`, metadatos e histórico | Sin migrar |

## Dependencias que impiden una sustitución directa

- Las altas de códigos usan secuencias y transacciones para evitar duplicados concurrentes.
- Cierre/corrección de sesiones, asistencias, auditoría e importaciones realizan cambios multientidad atómicos.
- Las claves compuestas, restricciones, relaciones, borrados y consultas indexadas no tienen equivalencia automática en SharePoint Lists.
- `Bytes`, arrays PostgreSQL, JSON y fechas `@db.Date` necesitan contratos de almacenamiento específicos.
- Los roles `USER`, `RESPONSIBLE` y `ADMIN` son autorización de aplicación; un token delegado de Graph no los reemplaza.
- Anexos e histórico dependen de consultas que cruzan múltiples agregados y de trazabilidad append-only.

## Corte vertical implementado

La lista `Trainings` admite alta, consulta y modificación de `code`, `year`, `name`, `planningType`, `reason`, `isGmp` y `originType`. Cada lectura conserva el ETag; cada modificación envía `If-Match` y convierte HTTP 412 en un conflicto visible. La biblioteca admite carga y recuperación de un archivo de 1 byte a 4 MB bajo `COVEX-Training-Manager/{trainingId}/`; una colisión de nombre falla en lugar de sobrescribir silenciosamente.

El cliente Graph limita los destinos a `https://graph.microsoft.com/v1.0/`, admite paginación con un máximo de 100 páginas y reintenta 429/503/504 respetando `Retry-After` con espera exponencial acotada. Los tokens se mantienen en memoria/session storage de MSAL y no se registran ni persisten en archivos.

## Decisión para H10B

**GO condicionado** para una validación corporativa del patrón local + Graph: el corte vertical compila, está empaquetado y dispone de pruebas simuladas. **NO-GO** para retirar PostgreSQL o migrar los 22 modelos: antes se deben diseñar numeración, transacciones compensatorias, autorización, auditoría, consultas, anexos y migración verificable, y ejecutar pruebas reales con el tenant de COVEX.
