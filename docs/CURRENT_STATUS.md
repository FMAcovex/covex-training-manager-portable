# Estado actual del proyecto

## H10B — edición portable en revisión

- PR única en borrador: https://github.com/FMAcovex/covex-training-manager-portable/pull/4.
- Proveedor `portable-sharepoint`, esquema/adaptadores 22/22, sesión Entra y módulos existentes conectados; sin PostgreSQL para el usuario portable.
- Escrituras coordinadas entre instalaciones, ETags, numeración, journal segmentado, bloqueo conservador ante fallos e integridad documental SHA-256.
- Smoke de la UI real con identidad firmada y Graph simulados; pruebas sintéticas, calidad, regresión H9A y artefacto Windows en CI.
- **H10B no aceptado con COVEX / NO-GO para datos reales.** Pendientes el piloto real y los bloqueos específicos de permisos delegados, auditoría, consistencia, plantillas y recuperación documentados en `H10B_SECURITY_AND_RECOVERY.md`.
- Resultado, cobertura y límites: `H10B_RESULT.md`; configuración/piloto: `H10B_IT_REQUIREMENTS.md`.
- Repositorio original preservado; no se ha hecho merge/squash ni comenzado la siguiente fase.

## Versión de especificación

`Functional Spec v1.0 — preparada para iniciar desarrollo`

## Completado

- Objetivo de la aplicación definido.
- Arquitectura objetivo preliminar definida.
- Separación Formación / Sesión definida.
- Estados de ejecución y documentación definidos.
- Flujo de planificación anual definido.
- Personal interno/externo definido.
- Asistencia y resultados definidos.
- Roles definidos.
- Control documental definido.
- Reglas generales de Anexos III, IV y V definidas.
- Roadmap por hitos definido.
- Hito 0 implementado: estructura Next.js + TypeScript, Prisma y configuración de lint/tests/build.
- Modelo Prisma mínimo para `Person`, `Department` y `UserProfile` con roles `USER`, `RESPONSIBLE` y `ADMIN`.
- Navegación base y módulo Personal con listado, alta, edición y desactivación lógica.
- Validación de servidor para Personal, abstracción de usuario demo y seed con datos ficticios.
- Pruebas de validaciones principales de Personal ejecutadas correctamente.
- Endurecimiento del Hito 0 completado: `PeopleRepository` desacopla las rutas de la implementación en memoria y deja preparada la implementación Prisma.
- Reglas de Personal reforzadas para departamento interno, empresa externa y normalización de opcionales.
- Catálogo de departamentos integrado en la interfaz y pruebas ampliadas a 7 casos.
- Activación y reactivación lógica de Personal completadas, conservando ID e histórico y tratando IDs inexistentes de forma segura.
- Hito 0 revisado, aceptado y cerrado tras su fusión en `main`.
- Hito 1 — Formaciones aceptado, fusionado en `main` y cerrado.
- Modelo Prisma de `Training` incorporado sin estado global persistido ni entidades de Sesión.
- Alta, listado con filtros propios de Formación, ficha y edición de datos generales disponibles.
- Validación Zod compartida cliente/servidor para Formación, incluida la obligatoriedad del motivo en no planificadas y la normalización de opcionales.
- `TrainingRepository` desacopla API/UI de la persistencia, con implementaciones en memoria y Prisma.
- Código visible `FOR-YYYY-NNNN` generado mediante numeración estable e independiente por año.
- Catálogos iniciales de tipo, modalidad y método de evaluación disponibles mediante una capa sustituible.
- Datos de demo de Formación completamente ficticios añadidos.
- Corrección final del Hito 1 completada: año de Formación inmutable tras el alta, edición permitida a `RESPONSIBLE` y `ADMIN`, y seed Prisma con secuencia anual monotónica y cobertura demo ampliada.
- Suite ampliada a 26 pruebas; `pnpm lint`, `pnpm test` y `pnpm build` ejecutados correctamente al finalizar el Hito 1.
- Hito 2 — Sesiones y Asistencia aceptado, fusionado en `main` y cerrado.
- Modelos Prisma `TrainingSession`, `Attendance` y `SessionCodeSequence`, con unicidad real de asistente por Sesión y relaciones con Formación y Personal.
- Códigos estables `FOR-YYYY-NNNN-SNN` con contador independiente por Formación y reserva transaccional en Prisma.
- `SessionRepository` desacopla API/UI de la persistencia, con implementaciones en memoria y Prisma y operaciones agregadas para alta, edición, finalización y no ejecución.
- Alta y edición de Sesiones, selección de personal interno/externo activo, ficha propia de Sesión y visualización de Sesiones dentro de la ficha de Formación.
- Finalización con asistencia y resultados coherentes (`ASISTE`/`NO_ASISTE`, `APTO`/`NO_APTO`), validación previa de evaluación interna y cierre `NO_EJECUTADA` con motivo.
- Estado global de Formación derivado de sus Sesiones y mostrado en listado y ficha, sin persistirlo como fuente primaria.
- Autorización en servidor para cierre y corrección posterior: solo `RESPONSIBLE`/`ADMIN` cierran y solo `ADMIN` modifica Sesiones cerradas.
- Datos demo ficticios de sesiones pendientes, ejecutadas y no ejecutadas, múltiples sesiones, personal interno/externo y resultados representativos.
- Corrección final del Hito 2 completada: seed monotónico para `SessionCodeSequence`, edición de Sesiones pendientes restringida a `RESPONSIBLE`/`ADMIN` y conservación estricta de las Asistencias históricas en la edición general de Sesiones cerradas.
- Endurecimiento técnico previo al PR completado: transiciones Prisma condicionadas atómicamente por estado actual, protección optimista frente a ediciones concurrentes y conservación de `globalStatus` calculado tras editar una Formación.
- Suite ampliada a 80 pruebas; `pnpm lint`, `pnpm test` y `pnpm build` ejecutados correctamente tras el endurecimiento final del Hito 2.
- Hito 3 — Anexo III aceptado, fusionado en `main` y cerrado.
- Módulo de anexos aislado con constructor de datos, selección de `TemplateVersion`, adaptador versionado, renderer PDF en memoria, validación estructural y servicio orquestador.
- Fixture sanitizado `RH-00/003/05-TEST-1` incorporado como configuración de desarrollo, sin datos personales ni copia de los documentos corporativos de referencia.
- Modelos Prisma `TemplateVersion` y `GeneratedDocument`, con trazabilidad de versión, sesión, usuario y fecha de cada generación.
- Generación permitida para Sesiones `PENDING` y `EXECUTED`, bloqueada para `NOT_EXECUTED`, con permisos explícitos para `USER`, `RESPONSIBLE` y `ADMIN` aplicados en servidor.
- Descarga PDF disponible desde la ficha de Sesión mediante `POST /api/sessions/[id]/annex-iii`, sin modificar Formación, Sesión, Asistencias ni estado documental.
- Corrección final de fidelidad incorporada: A4 vertical con márgenes de referencia, columnas proporcionales `16 / 32 / 21 / 28 / 25 / 18`, encabezado con logo sanitizado, referencia en su zona superior y fecha `dd/mm/yyyy`.
- Ajuste de texto basado en métricas Helvetica, paginación independiente de contenido/asistentes, observaciones sin truncado y validación geométrica de todas las regiones dentro del área imprimible.
- Calibración final previa a PR: 16 asistentes normales caben en una página, el pie se rebalancea siempre con al menos una fila, Observaciones reproduce la celda teal superior sin prolongarla por toda la altura y la numeración `X de N` queda alineada a la derecha.
- Consulta documental de departamentos históricos inactivos separada de la selección ordinaria de departamentos activos.
- Guía `ANNEX_III_VALIDATION.md` y generador reproducible de cuatro ejemplos ficticios: corto, texto largo, multipágina y extremo.
- Suite ampliada a 149 pruebas; `pnpm lint`, `pnpm test`, `pnpm build` y `pnpm annex-iii:validate` ejecutados correctamente tras la última calibración previa a PR.
- Validación específica esperada: ejemplo corto de 1 página/3 asistentes, textos largos de 3 páginas/8 asistentes, multipágina de 3 páginas/55 asistentes y extremo de 9 páginas/24 asistentes con 325 líneas de contenido y 20 de observaciones.
- Hitos 4 y 5 aceptados, fusionados y cerrados; se implementaron conjuntamente manteniendo su separación conceptual.
- Hito 4 — Plan anual y Anexo IV: proyección por `Training.year`, una fila por Sesión o fila provisional para una planificada sin Sesiones, filtros, resumen, orden estable y tratamiento de `NOT_EXECUTED` con justificación en Observaciones.
- Hito 5 — Historial individual y Anexo V: ficha de Persona, histórico exclusivo de `ATTENDED`, año por `executionDate`, conservación de `NO APTO`, renovaciones por meses de calendario y soporte de personal inactivo.
- Anexos IV y V incorporados al motor de anexos con builders, adaptadores versionados, renderers sobre primitivas PDF compartidas, validadores propios, `TemplateVersion` sanitizadas y trazabilidad `GeneratedDocument` generalizada.
- API y UI disponibles en `/plan-anual` y `/personal/[id]`; generación IV/V restringida a `RESPONSIBLE` y `ADMIN`, e historial completo restringido a esos mismos perfiles.
- Scripts reproducibles `annex-iv:validate`, `annex-v:validate` y `annexes:validate`; PDFs temporales permanecen bajo `tmp/` ignorado.
- Correcciones de revisión de Hitos 4 y 5 incorporadas: muestras IV/V construidas mediante la lógica real de producción, años del selector anual obtenidos del repositorio, `availableYears` limitado a formaciones realmente recibidas y enlaces de historial ocultos a `USER` también en la UI.
- Hito 6 — Control documental aceptado, fusionado y cerrado.
- `DocumentControl` 1:1 por Sesión mediante `sessionId` único, con repositorios memoria/Prisma, estado documental derivado y ausencia de registro ejecutado interpretada como `PENDIENTE`.
- Cola `/documentacion` exclusiva de Sesiones `EXECUTED`, con filtros por estado, año de `executionDate` y búsqueda por Formación/códigos; edición directa de los tres checks y acceso a la Sesión.
- API `GET /api/documentation` y `GET/PATCH /api/sessions/[id]/document-control`, con autorización de servidor para `RESPONSIBLE`/`ADMIN` y validación estricta de entrada.
- Bloque de control documental integrado en la ficha de Sesión; `PENDING` y `NOT_EXECUTED` no admiten controles y no se crean registros al finalizar.
- Datos demo ficticios para ausencia, documentación parcial y completa. El Hito 6 no almacena archivos y generar `ANNEX_III` no marca su firma.
- Suite ampliada a 239 pruebas; `pnpm db:generate`, `pnpm lint`, `pnpm test`, `pnpm build` y `pnpm annexes:validate` ejecutados correctamente al finalizar el Hito 6.
- Hito 7 — Administración y trazabilidad aceptado, fusionado y cerrado.
- Administración exclusiva de `ADMIN` disponible en `/administracion`, con áreas separadas para Usuarios, Catálogos, Plantillas y Auditoría, autorización de servidor y navegación condicionada.
- `UserProfileRepository` desacopla API/UI de Prisma, con implementaciones memoria/Prisma, unicidad de email e identificador Entra, identificador inmutable, baja lógica y protección del último `ADMIN` activo. No se han añadido contraseñas ni autenticación real.
- Catálogos administrables con baja lógica, código inmutable y protección del nombre histórico cuando existe una referencia. El modo demo comparte la fuente de catálogos con Formación y Personal.
- Registro de `TemplateVersion` como metadata, campos identificativos inmutables, ventanas activas no solapadas y activación validada contra la tupla completa de fixtures soportadas. SharePoint puede registrarse inactivo, pero no activarse. No hay subida de archivos ni conexión SharePoint.
- `AuditEvent` append-only con actor/timestamp de servidor, filtros y límite de consulta; auditoría de perfiles, catálogos, plantillas, correcciones de Sesiones cerradas y cambios reales de `DocumentControl`.
- Las escrituras críticas y su evento son transaccionales en Prisma y lógicamente atómicas en memoria. `GeneratedDocument` continúa siendo la trazabilidad específica de generación de Anexos III/IV/V.
- Correcciones de revisión del Hito 7: resolución histórica explícita de catálogos y departamentos inactivos con protección de nuevas asignaciones, registro único de metadata exacta para fixtures y paginación de auditoría con valores por defecto 100/0 y máximo 200.
- Suite ampliada a 283 pruebas; `pnpm db:generate`, `pnpm lint`, `pnpm test`, `pnpm build` y `pnpm annexes:validate` ejecutados correctamente tras las correcciones de revisión del Hito 7.

## No implementado todavía

- Aprovisionamiento real de Azure App Service, Microsoft Entra y PostgreSQL administrado.
- Secretos y variables corporativas reales.
- Activación real de SharePoint/Microsoft Graph, que sigue siendo opcional para el primer despliegue.
- Pruebas de aceptación sobre infraestructura corporativa y puesta en servicio.
- Validación corporativa integral de los 22 modelos y aceptación GMP de H10B.

## Estado de aceptación

Hitos 0–8: **ACEPTADOS, FUSIONADOS Y CERRADOS**.

Hito 8 fue fusionado en `main` mediante PR #10 tras CI completo satisfactorio y revisión final de autenticación, producción y migraciones.

## Siguiente fase

Hito 9: **IMPLANTACIÓN CORPORATIVA Y ACEPTACIÓN**. Requiere coordinación con IT para conectar Azure, Microsoft Entra, PostgreSQL y, si se decide, SharePoint.

## Dependencias externas para Hito 9

Antes de producción será necesaria coordinación con IT para los recursos/permiso corporativo que correspondan, especialmente:

- alojamiento Azure;
- Microsoft Entra ID;
- base de datos administrada;
- acceso a SharePoint para plantillas;
- políticas corporativas de seguridad/despliegue.

Estas dependencias no bloquean la creación del esqueleto y prototipo con datos ficticios en un entorno de desarrollo cloud.

## H10A — prototipo portable preparado

- Shell Electron Windows x64 sobre la aplicación Next.js existente, limitado a loopback.
- Autenticación Microsoft Entra mediante MSAL y PKCE, sin secreto de cliente.
- CRUD vertical de Formación y almacenamiento/recuperación documental mediante Microsoft Graph.
- Concurrencia optimista por ETag, reintentos y pruebas simuladas.
- Auditoría de los 22 modelos y requisitos de IT documentados en `H10A_PORTABLE_AUDIT.md` y `H10A_IT_REQUIREMENTS.md`.
- Validación real de Microsoft 365 pendiente de tenant, aplicación Entra y recursos SharePoint de IT.
- H10B implementado para revisión y pruebas sintéticas; aceptación corporativa bloqueada según la sección inicial.


## Hito 8 — cerrado e incorporado mediante PR #10

- Separación explícita entre modo demo y producción.
- Azure App Service + Microsoft Entra preparado mediante identidad de servidor.
- UserProfile continúa resolviendo autorización interna USER / RESPONSIBLE / ADMIN.
- Producción rechaza AUTH_MODE=demo y ausencia de DATABASE_URL.
- Cliente Prisma único y migración PostgreSQL inicial.
- Script seguro para primer ADMIN.
- /api/health para configuración y conectividad.
- Next.js standalone, scripts de despliegue y variables documentadas.
- Guía `IT_DEPLOYMENT.md` y recorrido `DEMO_FOR_IT.md`.
- CI de GitHub para generación Prisma, lint, tests, build y anexos.
- Hito 9 definido como implantación corporativa y aceptación.


## Rediseño visual corporativo — incorporado mediante PR #14

- Rama de trabajo: `ui/corporate-layout-dashboard`.
- Rediseño limitado a identidad visual, shell común y dashboard de Inicio.
- Incorporación del logo oficial de COVEX, navegación lateral corporativa y barra superior con usuario/rol.
- Dashboard alimentado exclusivamente con repositorios y reglas de dominio existentes: formaciones activas/completadas, sesiones pendientes y formaciones todavía sin sesiones.
- No se modifican Prisma, permisos, autenticación, estados de negocio, generación documental ni preparación del Hito 8.
- La extensión del patrón visual al resto de pantallas funcionales queda fuera de este primer PR.


## Ajustes del alta de Formación — incorporados mediante PR #15

- El logo oficial de COVEX permanece visible arriba a la izquierda en el shell común incorporado por la PR #14.
- El alta de Formación propone `No planificada` por defecto y explica la diferencia frente a `Planificada`.
- Todos los campos mostrados y aplicables son obligatorios en una nueva Formación, excepto frecuencia y observaciones, con validación equivalente en cliente y servidor.
- Se conserva la regla del motivo solo para no planificadas y se exige únicamente el formador correspondiente al origen.
- La etiqueta del campo principal se presenta como `Nombre del curso`.
- El Plan anual ofrece `Ver ficha` en cada fila para abrir la Formación correspondiente.
- La edición conserva compatibilidad con registros históricos incompletos.


## Rediseño visual transversal y experiencia del formulario — incorporado mediante PR #16

- El patrón corporativo del Inicio se extiende a Formaciones, Plan anual, Personal, Documentación y a las fichas principales mediante cabeceras, tarjetas, filtros y tablas coherentes.
- Se normalizan botones, campos, enlaces a registros, estados, resúmenes, vacíos, carga, foco visible y adaptación a móvil.
- El alta y la edición de Formación se organizan en tres bloques: identificación y planificación, diseño, y evaluación y seguimiento.
- La validación de Formación presenta errores junto a todos los campos afectados, los relaciona con ARIA y sitúa el foco en el primer campo inválido.
- Se añade una prueba unitaria específica para la asociación de errores del formulario; la suite queda en 313 pruebas satisfactorias.
- No se modifican Prisma, API, permisos, autenticación, estados de negocio ni generación documental.


## Refactor de cliente y auditoría de Formación — incorporado mediante PR #17

- El alta y la edición de Formación generan eventos append-only `TRAINING_CREATED` y `TRAINING_UPDATED` con actor, código y estados anterior/posterior.
- La persistencia Prisma guarda la Formación y su evento en una única transacción; el modo demo conserva atomicidad lógica y comparte el repositorio de auditoría de Administración.
- Las ediciones rechazadas no generan eventos de auditoría.
- Un cliente JSON común centraliza la validación de respuestas y la propagación de mensajes de error en los flujos de Formación y Plan anual.
- Los listados cancelan solicitudes obsoletas y aplican debounce a la búsqueda textual para impedir carreras entre respuestas y reducir tráfico.
- Se añaden pruebas del cliente HTTP, de la integración de auditoría y de su atomicidad lógica; la suite queda en 320 pruebas satisfactorias.


## Importación controlada de formaciones 2026 — incorporada mediante PR #18

- Nueva pantalla `Administración > Importar` exclusiva de `ADMIN`, con carga `.xlsx`, previsualización, resolución de correspondencias y confirmación explícita.
- Procesamiento en memoria de las hojas Personal, Sesiones y Asistencia; el archivo no se persiste.
- Validación de catálogos, personas, formadores, fechas exactas, resultados de asistencia, referencias, duplicados e incompatibilidades antes de escribir.
- Migración completa de personas, formaciones, sesiones y asistencias. Las filas repetidas de una Formación se agrupan como varias Sesiones.
- Escritura PostgreSQL en una sola transacción, registro `TrainingImportRun` con huella SHA-256 única y evento `TRAINING_IMPORT_COMPLETED`.
- La plantilla revisada contiene 263 filas brutas de asistencia; una repetición idéntica se consolida, dando 262 registros únicos importables.
- La suite queda en 325 pruebas satisfactorias; `pnpm db:generate`, `pnpm lint`, `pnpm test` y `pnpm build` se ejecutan como controles de cierre.


## Revisión adicional de PR #18 — multisessión, selección y catálogos

- Formadores internos, departamentos destinatarios y asistentes de Sesión usan selección compacta mediante desplegable, acción Añadir y etiquetas eliminables.
- Cada Sesión admite `blankAttendanceRows` para reservar filas manuales en el Anexo III sin crear registros ficticios de Personal o Asistencia.
- El Plan anual usa el estado global de la Formación: cualquier Sesión pendiente mantiene la Formación pendiente; solo todas ejecutadas producen estado ejecutado.
- Los KPI del Plan anual se calculan por Formación y no por número de filas/sesiones.
- Catálogo demo y seed ampliados con áreas operativas COVEX y tipos de formación, incluidos Inicial, Periódica/reciclaje, Reentrenamiento, Extraordinaria, Calidad/GMP, Técnica, Seguridad/PRL y Actualización/cambio.


## Persistencia local del modo demo — incorporada mediante PR #19

- Personas, catálogos, Formaciones, Sesiones, Asistencias y auditoría del modo demo se conservan bajo `.data/` entre reinicios.
- La persistencia productiva continúa siendo PostgreSQL y no cambia su comportamiento.
- `.data/` permanece ignorado por Git y no se incorpora al repositorio.


## Panel de revisión de integridad — incorporado mediante PR #20

- Nueva pantalla exclusiva de `ADMIN` en `Administración > Revisión de datos`.
- Servicio reutilizable e independiente de React que analiza Formaciones, Sesiones, Asistencias, Personas, Departamentos y catálogos mediante los repositorios comunes de demo/PostgreSQL.
- Totales de Formaciones revisadas, completas, con avisos y con errores; desglose por tipo y listado con navegación directa al expediente.
- Filtros por año, estado global derivado, departamento relacionado y tipo de incidencia.
- Distinción entre `ERROR` y `AVISO`, y entre referencia inactiva histórica válida y referencia pendiente que requiere revisión.
- Detección adicional de relaciones inexistentes, incoherencias de estado/fecha/motivo, asistencia/resultado, duplicados, códigos y campos mínimos respaldados por el modelo.
- Herramienta estrictamente de solo lectura: no modifica expedientes ni completa valores automáticamente y no requiere migración de Prisma.


## Registro de Formadores cualificados — incorporado mediante PR #21

- Nueva sección `Formadores` separada de `Personal`, manteniendo Personal como maestro de identidades.
- Cualificaciones independientes por Persona + materia/formación autorizada, con evidencia, alta, baja opcional y vigencia derivada.
- Los formadores pueden ser internos o externos. El tipo de Persona no determina el origen de la Formación.
- Una formación interna puede seleccionar cualquier Persona con cualificación vigente, interna o externa.
- Una formación externa puede seleccionar cualquier Persona con cualificación vigente o registrar manualmente una persona/entidad/organismo/web sin crear una cualificación.
- Adjuntos múltiples por formador con alta, descarga y retirada auditadas; la columna de adjuntos existe solo en la aplicación y no en el Anexo III.
- El Anexo III de Formadores se genera en Word con las seis columnas oficiales y el formato controlado.
- Importación controlada del DOCX del Anexo III con análisis en memoria, previsualización, correspondencia contra Personal y confirmación.
- Nueva migración Prisma para `TrainerQualification` y `TrainerDocument`.


## Estabilización final — PR #22

- El alta de `Nuevo formador` se consolida en una única operación de servidor para Persona + primera cualificación.
- PostgreSQL utiliza una única transacción Prisma; el modo demo revierte la Persona si falla la creación de la cualificación.
- Se unifican las reglas de formadores entre modo demo y PostgreSQL: formación interna admite formador cualificado interno o externo, pero no nombre manual; formación externa admite Persona cualificada o referencia manual.
- Se actualizan pruebas de regresión y documentación para reflejar el comportamiento final antes del Hito 9.


## PR #23 — Ciclo de vida de formadores y evidencias documentales

- Las cualificaciones de Formadores disponen de acciones explícitas para dar de baja y anular registros creados por error.
- La baja conserva la línea histórica con fecha de finalización; la anulación exige motivo, queda auditada y se oculta por defecto de la lista operativa.
- Los registros anulados no participan en selectores de Formaciones/Sesiones ni en la generación del Anexo III de Formadores.
- El control documental de cada Sesión admite varios archivos en las categorías Anexo III firmado, contenido/material y evaluaciones/exámenes.
- Los adjuntos se comparten entre la ficha de Sesión y la pantalla Documentación porque pertenecen al mismo `DocumentControl`.
- Adjuntar evidencia no marca automáticamente el check; confirmación y evidencia permanecen como acciones independientes.
- Alta y retirada de evidencias quedan auditadas. Los archivos se limitan a 10 MB cada uno.
- Se añade migración Prisma para el estado de anulación y para `DocumentControlAttachment`.


## Preparación adicional del Hito 9 — despliegue portable

Tras confirmar que IT no dispone actualmente de Azure, se prepara una vía de despliegue independiente de proveedor:

- Dockerfile reproducible para Node.js 22;
- demo mediante `docker-compose.demo.yml`;
- health check del contenedor contra `/api/health`;
- guía `HOSTING_WITHOUT_AZURE.md`;
- PostgreSQL continúa siendo obligatorio en producción;
- `AUTH_MODE=demo` continúa prohibido en producción;
- la autenticación corporativa para un despliegue fuera de Azure queda como decisión/implementación pendiente con IT.

Este bloque no modifica flujos funcionales, reglas GMP, permisos internos ni modelos de datos.


## PR #32 — cierre técnico previo al Hito 9

- Se eliminan patrones N+1 evidentes del Plan anual, listado de Formaciones e Historial individual mediante consultas batch de Sesiones/Formaciones.
- Se introduce respuesta segura para errores no controlados de API: los errores de dominio/validación conservan mensajes útiles y las excepciones internas devuelven un mensaje genérico con identificador de correlación.
- README e IT_DEPLOYMENT se alinean con el escenario actual: PostgreSQL obligatorio en producción y alojamiento posible en servidor/VM interno con Docker, quedando la autenticación Entra definitiva para el Hito 9 con IT.
- No se modifican reglas GMP, permisos internos, modelos Prisma ni autenticación corporativa.


## PR #33 — cierre documental, impresión y reapertura

- El estado de ejecución de Formación/Sesión sigue siendo independiente: `PENDING / EXECUTED / NOT_EXECUTED`.
- El control documental de una Sesión ejecutada añade `Expediente impreso` y tres estados derivados: `PRINT_PENDING`, `DOCUMENTATION_PENDING` y `CONFORMING`.
- La impresión es requisito obligatorio para cerrar documentalmente una Formación.
- Anexo III, material y evaluaciones pueden quedar sin marcar si cada ausencia se justifica individualmente.
- La Formación se puede cerrar documentalmente solo cuando todas sus Sesiones están ejecutadas y conformes para cierre.
- Cierre y reapertura de Formación quedan auditados; una Formación cerrada sigue siendo editable.
- RESPONSIBLE y ADMIN pueden editar Sesiones pendientes, ejecutadas y no ejecutadas. El conjunto de asistentes de una Sesión cerrada solo se modifica tras reabrirla.
- La reapertura de Sesión requiere motivo, devuelve la Sesión a Pendiente y reinicia asistencia operativa a EXPECTED/PENDING conservando el estado previo en AuditEvent.
- Una Sesión no puede reabrirse mientras su Formación siga documentalmente cerrada.

## H9A — Paquete de implantación privada con Microsoft Entra

- Preparado Docker multietapa, runtime sin root y arranque que rechaza configuración productiva inválida.
- Compose productivo con PostgreSQL persistente sin puerto público, migraciones explícitas, HTTPS, OAuth2 Proxy y Redis de sesiones.
- Nueva autenticación `entra-proxy`: secreto gateway, verificación JWT RS256/JWKS, tenant/audiencia/expiración y resolución de perfil activo. Demo y App Service conservados.
- Scripts de preparación/preflight, instalación, actualización, dump y restauración técnica en BD temporal. Seed ficticio bloqueado en producción.
- Documentación IT alineada con el servidor privado, responsabilidades y datos pendientes; el manual ya realizado no se repite.
- Pruebas añadidas para firma/claims, configuración, frontera HTTPS/identidad, arranque seguro, persistencia y backup/restore en CI. El smoke usa un IdP de prueba, no credenciales corporativas.
- Pendientes de H9B–H9D: respuesta IT, infraestructura, Entra real, certificado/DNS corporativos, registros/plantillas iniciales aceptados, migración/reconciliación y aceptación de puesta en servicio.
