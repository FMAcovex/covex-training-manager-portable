# H10D — demo interactiva Windows

Especificación: [Issue #7](https://github.com/FMAcovex/covex-training-manager-portable/issues/7).
Base H10C integrada `400e535dd14a4620c23c7676f8bb81710421b181`; candidata `0.4.0-rc.1`.
Rama `feature/h10d-interactive-demo`. Una PR en borrador, sin squash ni merge.

**DEMO — DATOS FICTICIOS. NO-GO para datos corporativos y uso GMP.**

## Implementación y frontera

Se reutilizan los formularios existentes de Personal, Formación y Sesión, validación Zod de cliente/servidor, repositorios InMemory, auditoría y generadores de anexos. No se introducen pantallas alternativas, cambios de esquema, reglas relajadas ni un proveedor paralelo.

La aceptación visual detectó y corrige un estado local obsoleto: al añadir/quitar asistentes mediante edición de sesión, el borrador de finalización debe sincronizarse inmediatamente con la lista guardada. La corrección de la UI compartida no cambia reglas ni permisos corporativos; evita finalizar con una lista antigua sin exigir recargar la página.

El middleware conserva host exacto, cookie efímera del proceso y Origin de H10C. En demo autoriza únicamente las siguientes mutaciones; cualquier otra combinación método/ruta queda denegada:

| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/people` | Alta opcional de persona ficticia |
| POST | `/api/trainings` | Crear formación |
| PATCH | `/api/trainings/:id` | Editar formación |
| POST | `/api/trainings/:id/sessions` | Crear sesión |
| PATCH | `/api/sessions/:id` | Editar sesión y su lista de asistentes |
| POST | `/api/sessions/:id/finalize` | Guardar asistencia/resultados y ejecutar |
| POST | `/api/sessions/:id/reopen` | Reapertura motivada para corregir resultados |
| POST | `/api/sessions/:id/annex-iii` | Descargar Anexo III ficticio |
| POST | `/api/annual-plan/:year/annex-iv` | Anexo IV existente |
| POST | `/api/people/:id/annex-v` | Anexo V existente |

Los identificadores se limitan a un segmento alfanumérico, guion o guion bajo. No se permite un prefijo completo de API, verbos alternativos ni subrutas de archivos. GET/HEAD conservan consultas existentes, salvo las API `/api/portable/*`, denegadas también en lectura. El DOCX de formadores existente sigue disponible.

Importaciones, archivos seleccionados por usuario, adjuntos, cambios documentales, cierre de formación, catálogos, roles, usuarios, cualificación y otras mutaciones administrativas siguen bloqueados. El selector de archivos permanece deshabilitado, con rechazo adicional en servidor. Los controles corporativos permanecen visualmente reutilizados: si se pulsa una operación no autorizada, se informa del bloqueo sin persistirla. La edición de asistentes significa la lista de personas de la sesión; no se habilitan bajas/activaciones ni edición del maestro de personal.

## Memoria y aislamiento

`demo-data-store` devuelve `undefined` al leer y no realiza ninguna E/S al guardar en modo escritorio demo. Cada repositorio conserva exclusivamente su estado mutable en el proceso local, incluyendo auditoría y contadores; se reconstruyen los datos ficticios al iniciar otro proceso. Una recarga de página conserva el estado mientras el proceso siga vivo; cerrar la ventana de trabajo o el EXE lo descarta.

No se accede a `.data`, OneDrive, rutas de usuario ni JSON funcionales previos, aunque exista `DEMO_DATA_DIR`. El lanzador sigue eliminando variables corporativas, preloads Node y credenciales heredadas. El proveedor es `demo`, autenticación `demo`, sin URL de base de datos, SharePoint deshabilitado y red de la ventana limitada al loopback propio. No hay promoción al piloto corporativo.

Los documentos sintéticos descargados voluntariamente sí permanecen como archivos del usuario. No son un almacén de registros, no se reimportan y no se borran al salir. La configuración pública del asistente H10C es independiente y conserva su funcionamiento anterior.

## Pruebas reproducibles y evidencias

- `pnpm quality`: Prisma generate, lint, suite completa, pruebas desktop, build, standalone fuera del checkout y validación de Anexos III/IV/V. No se eliminan pruebas existentes.
- `src/portable/desktop-policy.test.ts`: allowlist método/ruta, rutas y verbos prohibidos, mezcla de configuración, host/cookie/Origin y política corporativa conservada.
- `src/demo/desktop-memory.test.ts`: altas/ediciones, asistencias FAIL/ausencia, reapertura, auditoría anterior, seed y contadores reiniciados; spies comprueban cero llamadas al filesystem incluso con ruta heredada.
- `pnpm portable:demo:smoke`: UI real sobre Next standalone fuera del checkout, validación incompleta, persona ficticia, formación interna con formador cualificado, edición, sesión, edición de asistentes, rechazo de duplicados/resultados incompletos, FAIL/ausencia, reapertura/corrección, descarga real del Anexo III con comprobación de contenido, recarga y reinicio del servicio. Comprueba operaciones prohibidas, selector bloqueado, ausencia de `.data` y conexiones externas del navegador.
- `pnpm portable:desktop:smoke` en Windows: el mismo flujo sobre el **EXE del ZIP extraído**, con runtime embebido, instalación de solo lectura y ruta Unicode/espacios. Captura la descarga real de Electron y vuelve a abrir tanto el servicio como el EXE completo para comparar exactamente la semilla y comprobar 404 en los registros nuevos. Conserva los casos H10C: asistente, identidad de proceso, puerto ajeno, instancia única, cierre, fallo recuperable y autenticación corporativa sin fallback.
- `pnpm portable:smoke`: regresión H10B con JWT sintético firmado y Graph simulado, en Linux y Windows. Se mantienen migraciones PostgreSQL, Docker y smoke productivo H9A en sus jobs de CI.

Las ejecuciones y resultados concretos deben comprobarse en la CI enlazada desde la PR. Los artefactos `h10d-interactive-demo-synthetic` y `h10d-windows-acceptance-synthetic` contienen resultados JSON, capturas y PDF ficticio; no contienen credenciales corporativas. El artefacto `covex-training-manager-portable-windows-h10d` contiene el ZIP, SHA-256 y manifiesto.

Verificación local previa a la PR: `quality` correcto (48 archivos, 488 pruebas; 7 pruebas desktop, compilación y validación de anexos), 9 comprobaciones de despliegue, plan SharePoint dry-run sin conexión corporativa, smoke H10B firmado/Graph simulado y smoke demo interactiva correctos. El PDF descargado en el flujo demo contiene el curso editado, la persona ficticia y fecha de sesión; el proceso nuevo restaura la semilla. La prueba nativa Windows y los cuatro jobs completos se ejecutan en la CI de la PR, no se infieren de estas pruebas Linux.

## Conservación de H10C/H10B/H9A y límites

Los 22 modelos Prisma, adaptadores SharePoint, código Entra/MSAL/PKCE, permisos corporativos, concurrencia, numeración, integridad, importaciones y documentos de H10B no se modifican. La modalidad corporativa y el asistente H10C conservan sus controles. No se cambia el original, esquema/migraciones, generadores ni arquitectura H9A. La demo no pretende sustituir ni validar un backend multiusuario.

Pendientes: prueba personal del ZIP y Windows 10/11 físicos/usuario estándar; firma de código y aceptación AV/SmartScreen; Entra real, MFA/Conditional Access, SharePoint, permisos efectivos, auditoría, reconciliación, restauración y plantillas con IT/Calidad. No desactivar antivirus ni políticas para probarlo. Siguen vigentes los bloqueos de `H10B_SECURITY_AND_RECOVERY.md` y la matriz H10C. **Ninguna prueba simulada constituye validación corporativa COVEX.**

Guion de prueba personal: [Guía Windows](GUIA_INICIO_WINDOWS.md).
