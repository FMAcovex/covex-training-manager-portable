# H10B — bloqueos de seguridad, consistencia y recuperación

## Estado de aceptación

Código y pruebas simuladas entregados en la PR H10B. **NO-GO para datos reales y documentación GMP.** Una CI verde no demuestra autorización efectiva, inalterabilidad de auditoría o consistencia transaccional en el tenant corporativo.

## Permisos delegados: límite de confianza

MSAL usa una aplicación pública sin secreto. Los permisos efectivos son la intersección entre concesión a la aplicación y permisos del usuario. Un usuario con escritura puede invocar Graph fuera del ejecutable. `Sites.Selected` limita el sitio, pero no aplica por sí solo las reglas COVEX ni autentica los campos de un evento de auditoría.

IT debe separar grupos y permisos de lista/biblioteca y probar con llamadas Graph directas:

| Recurso | Control necesario fuera de la UI |
|---|---|
| `UserProfile`, catálogos, `TemplateVersion`, cualificaciones | Edición administrativa; impedir autoasignación de rol o activación de plantilla por otros usuarios |
| Formación, sesión, relaciones y asistencia | Altas por rol, edición/cierre/reapertura restringidos; SharePoint no expresa todas las reglas de estado y relación |
| `AuditEvent`, `GeneratedDocument`, `TrainingImportRun` | Retención, protección frente a edición/borrado y autenticidad de campos de auditoría |
| Secuencias y `CovexOperation` | Impedir manipulación externa de contadores y bloqueo; demostrar recuperación sin reutilizar números |
| Biblioteca y metadatos | Acceso mínimo, versionado, retención, hash y restauración consistente con las listas |

**Bloqueo:** una concesión general de escritura al sitio no garantiza estas restricciones ni una auditoría GMP inalterable. El backend local valida roles, pero no es una autoridad de confianza frente a su propio usuario. IT y Calidad deben aceptar controles corporativos demostrables o elegir una autoridad de escritura corporativa que aplique las reglas (H9A existente o un servicio administrado aprobado). H10B no instala esa alternativa ni amplía permisos automáticamente.

Las rutas bearer-only del POC H10A devuelven HTTP 410 en modo `portable-sharepoint`; se usan los módulos reales con sesión y roles COVEX. La configuración de producción rechaza tanto autenticación como persistencia demo.

## Escritura coordinada y concurrencia

Todos los métodos de escritura de los repositorios y la importación histórica comparten un coordinador. Reserva por ETag el registro `portable-global-write-lock` de `CovexOperation`. Otra instalación recibe conflicto y debe reintentar después. No hay espera con bloqueo indefinido ni reintento silencioso de una mutación incierta.

Antes de enviar cada mutación se registran modelo, UUID y acción. El journal no almacena tokens ni contenidos documentales. Cada 100 targets se crea un segmento independiente para respetar el límite de texto. Los binarios quedan registrados como intención antes de la carga/retirada.

Una validación rechazada antes de tocar datos libera el bloqueo. Un fallo tras intentar una escritura conserva `NEEDS_RECONCILIATION`. Si el proceso termina abruptamente o se pierde la conexión al actualizar el journal, puede quedar `HELD`/`RUNNING`; el bloqueo no caduca automáticamente. Esto evita continuar sobre un estado incierto, pero exige intervención de IT. No equivale a una transacción SQL ni proporciona aislamiento de lectura entre listas.

## Procedimiento de reconciliación para validar con IT

1. Detener las instalaciones y conservar el bloqueo. No repetir importaciones ni reiniciar secuencias.
2. Consultar `GET /api/admin/portable-operations`, exclusivo ADMIN y de solo lectura. Revisar operación, segmentos y suboperaciones. Si el proceso murió antes de crear el journal, usar el `operationId` del bloqueo y la ventana temporal.
3. Comparar registros, relaciones, asistencias, números reservados, binarios/versiones/hash y auditoría. Una mutación enviada puede estar aplicada aunque no llegara respuesta.
4. Completar o compensar cada target con una cuenta administrativa autorizada y conservar evidencia de la decisión. No reutilizar códigos ni borrar auditoría histórica; restaurar listas y biblioteca conjuntamente cuando corresponda.
5. Registrar la reconciliación y ejecutar revisión de integridad. Solo después IT puede marcar la operación como resuelta y cambiar el bloqueo a `FREE` con el ETag vigente. No borrar el bloqueo ni usar `If-Match: *`.
6. Reabrir una instalación, comprobar lectura/escritura y después la segunda. La fiabilidad y duración de este procedimiento real son criterios pendientes de aceptación.

No se incorpora una API de desbloqueo automático, ni se declara probada una restauración corporativa.

## Integridad documental y plantillas

Los nuevos adjuntos conservan SHA-256 y tamaño, comprobados al descargar. Las cargas usan UUID y conflicto `fail`; las retiradas incluyen ETag. El transporte por bloques admite hasta 250 MB; los módulos conservan los límites vigentes de 10 MB por archivo, 20 archivos y 50 MB por colección. Los adjuntos anteriores sin hash solo pueden comprobar tamaño hasta que IT los reconcilie.

Se conserva el motor y el diseño de Anexos III/IV/V. La metadata de plantilla se guarda en SharePoint, pero el cargador sigue admitiendo únicamente las fixtures controladas existentes; no carga genéricamente nuevas plantillas corporativas desde la biblioteca. Esas fixtures no son una aprobación GMP. El aprovisionamiento normal crea esquema vacío; `--seed-synthetic` solo sirve para un sitio piloto sintético.

## Pendiente de evidencia real

Consentimiento `Sites.Selected`, permisos efectivos por usuario/grupo, índices/unicidad reales, MFA/Conditional Access, dos usuarios Windows, firma del ejecutable, versionado/retención/DLP/antivirus y backup/restore conjunto. La prueba simulada de 5.001 registros acredita paginación del cliente, no superar el umbral real de vista de SharePoint.
