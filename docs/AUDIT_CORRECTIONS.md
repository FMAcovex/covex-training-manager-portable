# Fase correctiva única — auditoría del 20/10/2026

Estado: revisión técnica. **NO-GO para datos corporativos y GMP**. Se autorizan correcciones de los puntos 1–5; la validación real de IT/Calidad sigue abierta. El repositorio original y la arquitectura sin servidor privado de la edición portable se conservan.

## Cobertura de hallazgos

| Hallazgo | Corrección y comprobación |
| --- | --- |
| A01 | PATCH exige versión original; comparación dentro de la operación coordinada, 409 y borrador conservado. Pruebas de dos proveedores independientes y contrato API. |
| A02/A03 | Motivo/contexto de reapertura y acción `CLOSED_SESSION_CORRECTED` conservados íntegramente. |
| A04 | Decisión del responsable: reapertura explícita antes de crear/importar sesiones; rechazo anterior a reserva de numeración. |
| A05/A06 | Código duplicado, también de persona inactiva, rechazado antes de la primera mutación en portable; demo alineada. No se desbloquea un resultado incierto. |
| A07 | Sesión sin duplicación del array de asistencia; filas Attendance, contador/hash y lectura compatible de agregados antiguos. Eventos voluminosos segmentados con hash. Prueba completa con 250 asistentes, ejecución, reapertura y proveedor reiniciado. |
| A08 | Búsqueda por nombre/código/empresa/puesto, filtros de estado/tipo/departamento, páginas de 50 filas y preservación de IDs/histórico. |
| A09 | Foco inicial, trampa y restauración; Escape cancela cuando no está procesando. |
| A10/A11 | Catch/finally, borrador conservado, sin repetición automática; catálogos HTTP/forma comprobados, 401 visible y recarga de opciones. |
| A12 | Reenvío de controles iguales, incluso con distinto orden de claves, no cambia registro ni genera otro evento. |
| A13 | Codificación WinAnsi explícita, acentos NFC; carácter incompatible bloquea la generación con mensaje claro. Soporte Unicode integral requiere plantilla aprobada. |
| A14 | Plazo por petición Graph de 30 segundos, incluidos headers y cuerpo, señal de cancelación y ninguna repetición automática de escritura incierta de listas. |
| A15 | Actualización controlada; ver excepción de desarrollo y validaciones más abajo. |

## SharePoint e integridad

Se conservan los 22 modelos y las listas existentes. `TrainingSession` nuevo guarda `attendanceStorage=rows-v1`, número de asistencias y hash SHA-256 del conjunto ordenado por ID. Las filas Attendance son la fuente; la lectura falla ante filas faltantes, duplicadas o alteradas. El formato anterior embebido se lee sin migrarlo automáticamente. Al modificarlo se convierte dentro de la operación coordinada. El límite por payload sigue siendo 55.000 caracteres, validado por fila antes de reservar el número de sesión.

Los eventos AuditEvent que exceden el campo se dividen en segmentos con `storage=audit-chunk-v1`; la raíz conserva un manifiesto `audit-chunks-v1`, contador y hash del evento completo. La consulta reconstruye y comprueba antes de filtrar/paginar; no elimina before/after, motivos ni resultados anteriores. Los segmentos incompletos se detectan. Una interrupción mantiene el journal y bloqueo para reconciliación; no hay caducidad ni desbloqueo automático. Las raíces/segmentos deben respaldarse y restaurarse conjuntamente.

Los clientes antiguos no interpretan estos formatos: actualizar todas las instalaciones del piloto simultáneamente. Antes de cualquier migración corporativa, IT debe ensayar copia, actualización, rollback y restauración conjunta. No existe todavía aceptación de SharePoint real, SLA de volumen ni equivalencia con una transacción SQL. La consulta Graph continúa limitada a 100 páginas con error explícito; Personal pagina el DOM, pero la API aún recupera el maestro completo.

## Dependencias

Next/eslint-config-next 15.5.28; Vitest 4.1.11 elimina la cadena vulnerable de tinypool. Overrides explícitos: PostCSS 8.5.23, source-map-js 1.2.2, sharp 0.35.5, deepmerge-ts 8.0.0. Se conservan Prisma 6 y los proveedores H9A; no se migra framework ni modelo.

Análisis tras actualizar: **0 críticos y 1 alto de desarrollo**: braces 3.0.3, por `eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch`. El registro consultado no publica 3.0.4, versión corregida indicada por el aviso. No se inventa una versión ni se ignora el aviso en la herramienta. No es una cadena funcional del EXE según las dependencias actuales; debe confirmarse también el inventario final. Ejecutar lint únicamente sobre código de confianza hasta disponer de revisión compatible; no constituye aceptación corporativa. No se ejecuta `audit fix --force`.

## Pruebas y límites

- Suite de dominio/repositorios/API/PDF, tests desktop, compilación y anexos existentes conservados.
- Regresiones nuevas para concurrencia, duplicados, cierre/reapertura, trazabilidad, sesiones grandes, datos corruptos, formato antiguo, no-op, timeout/cuerpo estancado, WinAnsi y filtros.
- Escenario compartido Chromium/EXE: 121 personas ficticias con paginación/filtros, teclado de diálogo, 401, catálogo mal formado, interrupción POST y borrador conservado. Se incorpora al recorrido H10D de creación, resultados, PDF real y reinicio RAM.
- CI completa conserva migraciones/backup H9A, Docker, Windows y pruebas del EXE extraído. Solo declarar resultados del commit comprobado.
- En esta nube, la regeneración Prisma quedó bloqueada por política de acceso a `binaries.prisma.sh`. Se reutilizó el JavaScript generado previamente, tras comprobar igualdad del esquema salvo formato, para ejecutar las pruebas; sus tipos no bastaron para compilar. El bloqueo y la CI real se informarán en la entrega. Se guardó la adición del dominio en la configuración del entorno para revisión/publicación.

Pendientes de IT/Calidad: Entra y permisos reales, protección/autenticidad de auditoría y escritura fuera del EXE, dos equipos concurrentes, restauración real/RPO/RTO, Windows 10/11 físico/usuario estándar/firma/AV/SmartScreen/OneDrive, aceptación de plantilla y política histórica de datos maestros. Los PDF siguen preparándose desde los datos vigentes y GeneratedDocument conserva metadata; no se introduce un archivo oficial electrónico ni se reinterpreta un registro firmado en papel.
