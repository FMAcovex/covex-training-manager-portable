# Registro de decisiones — v1.0

Este documento contiene decisiones cerradas. Cambiarlas requiere actualizar este archivo y revisar el impacto en especificación, modelo de datos, flujos, pruebas y anexos.

## D-001 — Aplicación web interna

La solución será una aplicación web interna, accesible por navegador, no un ejecutable instalado en cada PC.

## D-002 — Cloud-first

La aplicación no dependerá de almacenamiento local permanente del usuario.

## D-003 — Arquitectura objetivo inicial

- Next.js + TypeScript + React.
- Azure App Service.
- Microsoft Entra ID.
- PostgreSQL en Azure.
- Prisma.
- Plantillas controladas alojadas en SharePoint COVEX.
- Repositorio cloud privado.
- Desarrollo asistido con Codex.

Esta arquitectura puede ajustarse con IT sin cambiar las reglas funcionales.

## D-004 — Formación y Sesión son entidades diferentes

Una Formación puede tener una o varias Sesiones.

## D-005 — Ejecución de Formación multisession

Una Formación con varias Sesiones solo se considera ejecutada cuando todas sus Sesiones previstas estén ejecutadas.

## D-006 — Codificación nueva

No se conservará obligatoriamente el código calculado del Excel actual. Se usará una codificación interna más amplia y legible.

Propuesta inicial:

- `FOR-YYYY-NNNN`
- `FOR-YYYY-NNNN-SNN`

## D-007 — Estados separados

Estado de ejecución y estado documental son independientes.

Una Sesión puede estar `EJECUTADA` con documentación `PENDIENTE`.

## D-008 — Documentación mínima controlada

Tres checks:

1. Anexo III firmado.
2. Contenido/presentación/material archivado.
3. Evaluaciones/exámenes archivados.

No son obligatorios para pasar a `EJECUTADA`.

## D-009 — No es obligatorio cargar archivos en V1

Los checks documentales pueden completarse sin adjuntar documentos.

## D-010 — Modificación de sesiones ejecutadas

Solo Administrador puede modificar una Sesión ya ejecutada.

## D-011 — Personal externo

El personal externo puede guardarse en el maestro de Personal y debe estar claramente identificado como `EXTERNO`.

## D-012 — Plan por años

Planes y consultas principales se separan por año.

Las planificadas se incorporan inicialmente al Plan anual. Las no planificadas se incorporan durante el ejercicio.

## D-013 — Planificadas no ejecutadas

Permanecen en el Plan y requieren justificación/observación cuando se cierren como no ejecutadas.

## D-014 — Historial individual por año

El historial de cada trabajador puede filtrarse por año. El Anexo V se genera para `Persona + Año`.

## D-015 — Método y criterio de evaluación

Para formaciones internas, método de evaluación y criterio de aptitud deben formar parte de los datos definidos antes de impartir. Son independientes del control posterior de si las evaluaciones están archivadas.

## D-016 — Resultado por defecto al finalizar

La interfaz puede inicializar asistentes previstos como `ASISTE` + `APTO` para acelerar el cierre, permitiendo modificar las excepciones antes de guardar.

## D-017 — Anexos como plantillas controladas

Los Anexos III, IV y V no se rediseñan desde la aplicación. Se cumplimentan a partir de versiones controladas.

## D-018 — Histórico de plantillas

Las nuevas versiones del PNT/anexos no deben modificar documentos históricos ni borrar la referencia a la versión utilizada.

## D-019 — Aplicación auxiliar

La V1 sirve para gestión y preparación de registros; no implementa firma electrónica ni sustituye el circuito de anexos impresos/firmados.

## D-020 — Prototipo de identidad del Hito 0

El Hito 0 utiliza una abstracción de usuario demo con rol `ADMIN` para poder validar autorizaciones en servidor sin gestionar contraseñas ni introducir una autenticación local definitiva. La sustitución por Microsoft Entra ID queda reservada para la preparación de producción.

## D-021 — Repositorio de Personal

Las rutas de Personal dependen de la interfaz `PeopleRepository`, no de una colección concreta. El Hito 0 mantiene una implementación en memoria para demo/tests y una implementación Prisma preparada para activarse mediante `DATABASE_URL`, sin desplegar PostgreSQL ni servicios externos.

## D-022 — Repositorio y numeración de Formación

Las rutas de Formación dependen de la interfaz `TrainingRepository`, con implementación en memoria para demo/tests e implementación Prisma seleccionada mediante `DATABASE_URL`.

La implementación Prisma reserva el siguiente número mediante `TrainingCodeSequence`, con un contador independiente por año actualizado dentro de la misma transacción que crea la Formación. El código visible conserva el formato `FOR-YYYY-NNNN`; el identificador técnico continúa siendo un UUID independiente.

## D-023 — Agregado y numeración de Sesión

Sesión y Asistencia se persisten mediante una abstracción `SessionRepository`, con implementaciones en memoria y Prisma seleccionadas mediante `DATABASE_URL`. Las operaciones de alta, cambio de asistentes y finalización mantienen el agregado de forma transaccional o lógicamente atómica.

La implementación Prisma reserva el siguiente sufijo `SNN` mediante `SessionCodeSequence`, con un contador independiente por Formación actualizado dentro de la misma transacción que crea la Sesión. No se calculan códigos mediante `máximo + 1` como única protección y los números emitidos no se reutilizan.

## D-024 — Arquitectura y plantilla de desarrollo del Anexo III

El motor de anexos se mantiene aislado de Formación, Sesión, repositorios de negocio, rutas y componentes React. El flujo separa construcción del modelo documental, selección de `TemplateVersion`, adaptación del layout, render PDF, validación y registro de `GeneratedDocument`.

El Hito 3 usa un renderer PDF puro en Node que trabaja completamente en memoria, sin Office, COM, LibreOffice, binarios nativos ni almacenamiento permanente. El adaptador `RH-00/003/05-TEST-1` es un fixture sanitizado de desarrollo: conserva estructura, textos fijos, geometría y colores observados en la referencia local, pero no sustituye la plantilla corporativa controlada ni contiene datos históricos. Su aceptación visual definitiva requiere revisión humana.

La selección de plantilla depende de un repositorio desacoplado con implementaciones memoria y Prisma. Solo puede resolverse una versión activa y vigente; la ausencia, ambigüedad o proveedor no soportado bloquea la generación. En una fase futura, el proveedor de almacenamiento podrá sustituirse por SharePoint/Microsoft Graph sin cambiar el modelo documental ni las reglas de Formación y Sesión.

## D-025 — Fidelidad y tipografía del fixture de Anexo III

El fixture `RH-00/003/05-TEST-1` reproduce la geometría de la hoja local `Formato_Firma`: A4 vertical, márgenes de referencia, proporciones `16 / 32 / 21 / 28 / 25 / 18`, bloques, colores, bordes, textos fijos y logotipo sanitizado. El libro de referencia y sus datos no forman parte del repositorio.

Calibri no se incorpora por no disponer de una base de redistribución adecuada para el entorno cloud. El renderer utiliza Helvetica y Helvetica-Bold, fuentes estándar PDF, con medición por métricas reales de glifo y tamaños/pesos ajustados. Esta alternativa prioriza portabilidad legal y robustez sin afirmar identidad tipográfica o geométrica píxel a píxel.

Contenido, asistentes y observaciones se paginan dentro del área imprimible. El plan de render conserva regiones y recuentos completos que el validador verifica antes de aceptar el documento. La consulta documental de departamentos incluye inactivos para conservar nombres históricos, mientras las selecciones ordinarias continúan mostrando solo activos.

La calibración vertical reproduce el efecto de impresión `Fit To Page` de la hoja de referencia: 16 asistentes normales de una línea caben en una página A4. Cuando el pie no cabe, la paginación reserva y mueve al menos una fila para acompañarlo; no se generan páginas de asistentes con cabecera y cero filas salvo en una sesión realmente vacía. El contador de página reproduce el formato numérico `X de N` alineado a la derecha.

## D-026 — Implementación conjunta de Hitos 4 y 5

Plan anual/Anexo IV e Historial individual/Anexo V se implementan en un único ciclo autorizado, manteniendo módulos, builders, adaptadores, validadores, API y UI separados. El Hito 6 no se inicia.

## D-027 — Plan anual como proyección

El Plan no se persiste como copia. Se proyecta por `Training.year`: cada Sesión genera una fila y una Formación planificada sin Sesiones genera una sola fila provisional. Al existir Sesiones, la provisional desaparece. El PDF IV incluye todas las planificadas y solo las no planificadas ejecutadas; la UI puede mostrar todas las no planificadas.

## D-028 — Año y contenido del historial individual

El historial incluye exclusivamente Asistencias `ATTENDED`. El año se determina por `TrainingSession.executionDate`, no por `Training.year`. El personal inactivo conserva su histórico y `FAIL` permanece visible como `NO APTO`.

## D-029 — Renovación calculada

La próxima renovación se deriva únicamente para `PASS` con `Training.frequencyMonths`, sumando meses de calendario a `executionDate` y ajustando el día al final del mes de destino cuando sea necesario. No se persiste ni se calcula para `FAIL`.

## D-030 — Permisos del Plan, historial y Anexos IV/V

`USER`, `RESPONSIBLE` y `ADMIN` pueden leer el Plan. Solo `RESPONSIBLE` y `ADMIN` pueden consultar el historial individual completo y generar Anexos IV/V. La autorización se aplica en servidor además de la UI; no se implementan ámbitos departamentales en este ciclo.

## D-031 — GeneratedDocument generalizado

`GeneratedDocument` admite referencias nulas validadas por combinación: Sesión para III, Año para IV y Persona+Año para V. El registro se crea únicamente después de construir, renderizar y validar correctamente el PDF. Los tres anexos comparten selección de plantilla, primitivas PDF, logo, métricas y trazabilidad, con adaptadores específicos.

## D-032 — Control documental por Sesión ejecutada

`DocumentControl` mantiene una relación 1:1 con `TrainingSession` mediante `sessionId` único. `documentStatus` no se persiste: se deriva como `COMPLETE` únicamente cuando los tres controles son verdaderos y como `PENDING` en cualquier otro caso. Una Sesión `EXECUTED` sin registro equivale a tres controles falsos y estado `PENDING`; el registro solo se crea o actualiza cuando un usuario autorizado guarda.

La cola documental incluye exclusivamente Sesiones `EXECUTED` y usa `executionDate` para el filtro anual. Los controles no aplican a Sesiones `PENDING` o `NOT_EXECUTED`. `RESPONSIBLE` y `ADMIN` pueden consultar y actualizar; `USER` no accede a la pantalla específica ni modifica controles. El Hito 6 no almacena archivos. La existencia o generación de un `GeneratedDocument` `ANNEX_III` no confirma que el Anexo III esté firmado y nunca marca automáticamente ese control.

## D-033 — Administración exclusiva de ADMIN

La sección y las API `/administracion` son exclusivas de `ADMIN`, con denegación aplicada en servidor además de ocultar la navegación a `USER` y `RESPONSIBLE`.

## D-034 — UserProfile no autentica en Hito 7

`UserProfile` administra identificadores, perfiles, roles y estado, sin contraseñas ni login local. `getCurrentUser()` continúa siendo la identidad demo; Microsoft Entra se conectará únicamente en el Hito 8. `entraObjectId` queda inmutable, no se borran perfiles y ninguna operación puede dejar el sistema sin un `ADMIN` activo.

## D-035 — Catálogos históricos no se sobrescriben

Los catálogos se desactivan, no se borran. El código es inmutable desde el alta. Si un elemento está referenciado por Formación o Personal, tampoco puede cambiarse su nombre: se desactiva y se crea otro. Los inactivos se excluyen de selecciones nuevas y continúan resolviendo históricos mediante consultas explícitas `includeInactive`; una edición puede conservar su referencia inactiva actual, pero ni un alta ni una edición pueden asignar otra referencia inactiva. Esta regla se valida en servidor para catálogos de Formación y departamentos. El modo demo comparte una única fuente en memoria con los repositorios ordinarios.

## D-036 — Administración de TemplateVersion como metadata

Hito 7 registra metadata y ventanas de vigencia; no carga ni almacena ficheros. Tras el alta son inmutables anexo, procedimiento, versión, proveedor y referencia. Solo se modifican estado y vigencia; las versiones históricas no se borran.

## D-037 — Activación segura de plantillas

Solo puede existir una versión activa con vigencia coincidente por `AnnexType`. La activación de `DEVELOPMENT_FIXTURE` exige que la tupla completa (`annexType`, `procedureCode`, `templateVersion`, `storageProvider`, `storageReference`) coincida con el registro compartido de fixtures que usa también `TemplateProvider`; así la metadata no puede contradecir la identificación fija impresa. `SHAREPOINT` puede registrarse inactivo, pero no activarse hasta el Hito 8.

## D-038 — AuditEvent append-only

`AuditEvent` solo admite inserción desde servidor. Actor y timestamp no proceden del cliente. Las escrituras críticas y su evento comparten transacción Prisma; el modo memoria conserva atomicidad lógica. No existe API de actualización o borrado.

## D-039 — Alcance de auditoría del Hito 7

Se auditan perfiles y roles, activación/corrección de catálogos, registro/vigencia/activación de plantillas, corrección general de Sesiones cerradas y cambios reales de `DocumentControl`. Un PATCH documental sin cambios no genera evento. La generación normal de anexos continúa trazada exclusivamente por `GeneratedDocument`.

## D-040 — Corrección de sesiones cerradas

La edición general por `ADMIN` de una Sesión `EXECUTED` o `NOT_EXECUTED` crea `CLOSED_SESSION_CORRECTED` con estado relevante anterior y posterior. La edición ordinaria de una Sesión `PENDING` no genera este evento.


## D-041 — Separación demo / producción

El modo demo se conserva para desarrollo, pruebas y presentación a IT. Producción se detecta mediante `APP_ENV=production` o el entorno de Azure App Service y no puede utilizar `AUTH_MODE=demo` ni repositorios en memoria. PostgreSQL es obligatorio en producción.

## D-042 — Autenticación mediante Azure App Service

La autenticación objetivo se delega en la autenticación integrada de Azure App Service con Microsoft Entra. La aplicación no almacena contraseñas. El identificador corporativo recibido en servidor se relaciona con `UserProfile.entraObjectId`; el rol de aplicación continúa almacenado internamente.

## D-043 — Primer administrador

El primer `ADMIN` se crea mediante un comando de bootstrap ejecutado durante la implantación con variables temporales. El comando no modifica usuarios si ya existe un ADMIN activo. Después del bootstrap, la gestión ordinaria se realiza desde Administración.

## D-044 — PostgreSQL productivo con migraciones

La producción utiliza Prisma contra PostgreSQL y se despliega mediante migraciones versionadas. El modo memoria queda limitado a desarrollo/demo.

## D-045 — SharePoint opcional en el primer despliegue

SharePoint no es requisito para iniciar la aplicación. Su futura integración se mantiene separada y deberá usar acceso restringido a la ubicación aprobada de plantillas.

## D-046 — Hito 9 separado

El Hito 8 termina cuando la aplicación está preparada y validada sin secretos ni infraestructura corporativa. El Hito 9 comprende aprovisionamiento/configuración real por IT, conexión de Azure/Entra/PostgreSQL/SharePoint cuando corresponda, pruebas de aceptación y puesta en servicio.


## D-047 — Alta completa y criterio de planificación

En el formulario de nueva Formación, todos los campos mostrados y aplicables son obligatorios, salvo frecuencia y observaciones, y la validación se aplica tanto en cliente como en servidor. El motivo sigue siendo obligatorio únicamente para UNPLANNED. La selección de formadores se rige por D-055: una formación interna exige al menos una Persona con cualificación vigente; una formación externa puede usar Personas cualificadas o una referencia manual.

El alta propone UNPLANNED por defecto. La interfaz explica que una formación planificada es la incluida en el Plan de Formación elaborado a principios de año y que una no planificada es la que no estaba incluida en dicho Plan. La edición de históricos mantiene la compatibilidad con registros anteriores que puedan contener campos opcionales.


## D-048 — Acceso a la ficha desde el Plan anual

Cada fila de las tablas de formaciones planificadas y no planificadas muestra un enlace `Ver ficha` que abre el registro de la Formación correspondiente. Las filas provisionales y las filas de Sesión enlazan siempre a la ficha de su Formación mediante `trainingId`.


## D-049 — Patrón visual común y validación accesible

Las pantallas funcionales reutilizan el lenguaje visual corporativo del Inicio: cabecera de página, tarjetas, filtros, tablas, estados, vacíos, carga y acciones con comportamiento responsive. Esta normalización es exclusivamente de presentación y no modifica permisos, estados ni reglas de negocio.

El formulario de Formación agrupa los campos por contexto y, cuando la validación compartida Zod falla, muestra el mensaje junto a cada campo, un aviso resumen y mueve el foco al primer campo inválido. Los mensajes se relacionan mediante atributos ARIA. La validación de servidor continúa siendo la autoridad y no se sustituye por la experiencia de cliente.


## D-050 — Auditoría de Formación y cliente HTTP común

El alta y la edición de una Formación generan respectivamente `TRAINING_CREATED` y `TRAINING_UPDATED`, con entidad `TRAINING`, actor obtenido de la sesión de servidor, código visible en el contexto y estados anterior/posterior cuando corresponda. En Prisma, la escritura y el evento comparten la misma transacción; en memoria, el evento se añade antes de publicar el cambio para conservar atomicidad lógica. Una operación rechazada no genera auditoría.

Las consultas JSON de Formación y Plan anual usan un cliente común que valida el estado HTTP y conserva los mensajes de error de la API. Los listados cancelan peticiones sustituidas y retrasan brevemente la búsqueda textual, evitando que una respuesta antigua reemplace filtros más recientes y reduciendo llamadas innecesarias. Este cambio no modifica reglas de negocio, permisos ni el contrato de las API.

## D-051 — Importación controlada de la plantilla 2026

La importación del histórico 2026 es exclusiva de `ADMIN` y sigue dos fases: previsualización y confirmación. El `.xlsx` se procesa en memoria y no se almacena. Antes de escribir se exige resolver los tipos, modalidades, departamentos, personas, formadores, fechas exactas y resultados incoherentes; la aplicación no inventa datos ambiguos.

La confirmación vuelve a leer y validar el archivo. En PostgreSQL crea personas, formaciones, sesiones, asistencias, secuencias, `TrainingImportRun` y `AuditEvent` en una única transacción. `sourceFingerprint` es único e impide importar dos veces el mismo archivo. Los códigos visibles continúan siendo los generados por la aplicación; los identificadores de origen se usan solo durante la resolución.

Una formación repetida en varias filas de la hoja se importa una sola vez con varias sesiones. Dos filas de asistencia idénticas para la misma persona y sesión se consolidan con aviso porque el modelo admite un único registro; duplicados con contenido distinto bloquean la operación. Los campos de evaluación ausentes en el histórico se conservan vacíos con aviso y deberán completarse antes de ejecutar nuevas sesiones internas.


## D-052 — Selección múltiple compacta de destinatarios y formadores

Una Formación puede tener varios formadores cualificados previstos, internos o externos, y varios departamentos destinatarios. Una Sesión puede tener varios formadores reales. En formularios con catálogos potencialmente grandes, la selección se presenta como desplegable + acción `Añadir` + elementos seleccionados eliminables, evitando listas completas de checkboxes. La pertenencia de una Persona a su departamento continúa siendo única.

## D-053 — Filas manuales del Anexo III y estado global en Plan anual

Cada Sesión puede reservar un número entero no negativo de filas en blanco para el Anexo III. Estas filas se renderizan únicamente en el documento y no crean Personas ni Asistencias ficticias.

El estado mostrado en el Plan anual es el estado global de la Formación: si existe al menos una Sesión `PENDING`, la Formación permanece `PENDING`; solo es `EXECUTED` cuando todas sus Sesiones están `EXECUTED`. La misma regla aplica a planificadas y no planificadas. Los resúmenes del Plan cuentan Formaciones, no filas de Sesión.

## D-054 — Revisión de integridad sin modificación automática

`Administración > Revisión de datos` obtiene Formaciones, Sesiones, Asistencias, Personas, Departamentos y catálogos mediante las abstracciones de repositorio existentes, por lo que utiliza la misma lógica en modo demo y PostgreSQL. El análisis se implementa en un servicio independiente de React y no requiere nuevas tablas ni estado persistido.

El panel es de solo lectura: no crea, corrige ni completa valores. Un `ERROR` identifica una contradicción con invariantes ya vigentes o una referencia inexistente; un `AVISO` identifica un dato incompleto compatible con históricos o una referencia inactiva que debe contextualizarse. Las referencias inactivas de expedientes cerrados se presentan como histórico válido; en expedientes pendientes se señalan para revisión antes de continuar.

Las formaciones se clasifican de forma mutuamente excluyente como completas, con avisos o con errores; la presencia de cualquier error prevalece sobre los avisos. El estado global se deriva siempre de las Sesiones y solo se compara con un estado informado cuando la fuente proporciona ese snapshot, sin convertirlo en un campo persistido.


## D-055 — Registro separado de Formadores cualificados

`Personal` continúa siendo el maestro único de identidades. `Formadores` no duplica personas: registra una o varias cualificaciones por Persona y por materia/formación autorizada, con evidencia, fecha de alta y fecha de baja opcional. Una fecha de baja vacía representa una autorización sin baja registrada; la vigencia se deriva de las fechas y no se persiste como estado independiente.

El tipo INTERNO/EXTERNO procede de `Person.personType`, pero no determina el origen de la Formación. Una formación interna puede ser impartida por una Persona cualificada interna o externa; en ese caso debe seleccionarse desde el registro de Formadores. En una formación externa se permiten dos vías: seleccionar cualquier Persona con cualificación vigente, interna o externa, o registrar manualmente uno o varios nombres de formador, entidad, organismo, curso público o plataforma web; esta vía manual no crea Persona ni cualificación. Los nombres manuales no se permiten para una formación interna. La materia autorizada se presenta como ayuda de selección y no se realiza una equivalencia automática entre su texto libre y el nombre de un curso. Las referencias externas por nombre siguen siendo compatibles con el histórico.

Los documentos de evidencia se adjuntan por Persona formadora y pueden ser múltiples. No añaden columnas al formato controlado: la exportación de datos del Anexo III conserva exclusivamente FORMADOR CUALIFICADO, MATERIA / FORMACIÓN AUTORIZADA, EVIDENCIA DE CUALIFICACIÓN, FECHA DE ALTA, FECHA DE BAJA e INTERNO / EXTERNO.

La importación del Anexo III DOCX es exclusiva de ADMIN, usa previsualización y confirmación, exige vincular cada nombre a una Persona existente del tipo correcto y procesa el fichero en memoria sin conservarlo. Los datos reales del documento no se incorporan al repositorio ni al seed demo.


## D-056 — Descarga del Anexo III de Formadores en Word

La descarga oficial del registro de Formadores cualificados se genera en formato DOCX y reproduce la estructura controlada del Anexo III del PNT RH-00/008/02: portada, páginas de listado en orientación horizontal, cabecera/pie, tabla de seis columnas, agrupación de celdas por formador y bloque final de aprobación. La columna interactiva de documentos adjuntos no forma parte del Anexo III.

La aplicación genera el documento únicamente con los datos del registro vigente en la base de datos. La plantilla visual usada como referencia no se versiona con datos personales reales; el repositorio conserva solo recursos sanitizados y lógica de renderizado.


## D-057 — Alta atómica de nuevo formador cualificado

El flujo `Nuevo formador` crea la Persona y su primera cualificación mediante una única operación de servidor. En PostgreSQL, Persona, `TrainerQualification` y `AuditEvent` se escriben dentro de la misma transacción Prisma. En modo demo, la operación conserva atomicidad lógica: si falla la creación de la cualificación o su auditoría, se revierte la Persona recién creada y no queda un registro huérfano.

La interfaz no encadena dos llamadas independientes ni expone un estado intermedio de Persona creada sin cualificación.


## D-058 — Baja y anulación trazable de cualificaciones de formadores

Una cualificación puede finalizarse mediante una **baja**, que registra `qualifiedTo` y conserva la línea como histórico. A partir de esa fecha deja de ser vigente y no se ofrece en nuevas Formaciones o Sesiones, pero continúa formando parte del registro histórico y del Anexo III con su fecha de baja.

Cuando una línea se creó por error se utiliza **anulación**, no borrado físico. La anulación exige motivo, usuario y fecha/hora de servidor, genera `TRAINER_QUALIFICATION_ANNULLED` y excluye la línea de los selectores y del Anexo III operativo. Los registros anulados siguen consultables mediante la opción de mostrar anulados y permanecen en auditoría. Anular una cualificación no elimina ni desactiva la Persona maestra.

## D-059 — Evidencias adjuntas del control documental

Los tres controles posteriores a la ejecución —Anexo III firmado, contenido/material archivado y evaluaciones/exámenes archivados— admiten múltiples archivos de evidencia por Sesión y categoría. Las evidencias pertenecen al mismo `DocumentControl`, por lo que son las mismas tanto desde la ficha de Sesión como desde `/documentacion`.

Adjuntar o retirar un archivo no modifica automáticamente el valor del check. El archivo representa evidencia almacenada; el check continúa siendo la confirmación explícita del usuario responsable. Las altas y retiradas de archivos se auditan de forma append-only. El primer despliegue puede almacenar estos binarios en PostgreSQL; la interfaz y el contrato quedan separados para permitir sustituir el almacenamiento por SharePoint u otro repositorio corporativo en una fase posterior.


## D-060 — Portabilidad de alojamiento para el Hito 9

La arquitectura objetivo deja de depender de Azure App Service como única plataforma de alojamiento. La aplicación debe poder empaquetarse como contenedor Docker o ejecutarse en una VM/hosting Node.js compatible, manteniendo PostgreSQL como persistencia obligatoria de producción.

El empaquetado portable no cambia por sí mismo la decisión de identidad. La implementación productiva actual `AUTH_MODE=app-service` sigue siendo válida para Azure App Service. Si la implantación se realiza fuera de Azure, deberá acordarse con IT e implementarse explícitamente una autenticación corporativa segura —por ejemplo Microsoft Entra mediante OIDC directo o un gateway corporativo de confianza— antes de abrir la aplicación a usuarios reales.

`AUTH_MODE=demo` permanece limitado a desarrollo y demostración y nunca se utilizará como mecanismo de autenticación productiva. La decisión del proveedor de hosting, TLS, DNS, secretos, logs y backups corresponde a la implantación del Hito 9 y no modifica las reglas funcionales.

## D-061 — H9A: servidor privado y Entra mediante proxy OIDC

Por autorización del responsable se prepara una única PR H9A para un ordenador/servidor privado COVEX, sin exigir Azure. La ruta de referencia usa contenedores Linux, NGINX HTTPS, OAuth2 Proxy de tenant único, Redis para sesiones temporales y PostgreSQL local persistente. `AUTH_MODE=entra-proxy` exige secreto aleatorio del gateway y JWT firmado, validado mediante JWKS de Entra con issuer, audience, expiración, `tid` y `oid`. Se autoriza por `UserProfile` activo, manteniendo los roles existentes y sin contraseñas locales. App Service se conserva para su infraestructura original.

D-003/D-042 quedan complementadas para este alojamiento. SO, DNS/URL, certificados, recursos, red y políticas operativas se confirman con IT antes de instalar. H9A no modifica modelo Prisma ni flujos de formación; no inicia SharePoint ni otras ampliaciones funcionales. Manual y pruebas ya realizados se conservan; login real, migración, recuperación funcional y aceptación corporativa se verifican en H9B–H9D. El seed demo queda prohibido en producción.

## D-062 — H10A: prueba vertical Windows con Graph, sin migración integral

H10A conserva Next.js y añade un shell Electron que sirve la compilación standalone exclusivamente por loopback. La identidad es un cliente público Microsoft Entra mediante MSAL Browser, Authorization Code + PKCE y permisos delegados; no existe secreto de cliente. El prototipo usa una SharePoint List para siete campos de Formación y una biblioteca para documentos, con ETags obligatorios, reintentos acotados y errores explícitos.

Esta prueba no sustituye PostgreSQL ni cambia los repositorios funcionales existentes. La equivalencia de transacciones, numeración, relaciones, roles, auditoría, anexos y migración de los 22 modelos se reserva a una decisión H10B posterior a la validación corporativa. Hasta entonces solo se usarán datos ficticios y recursos piloto restringidos.

## D-063 — H10B: proveedor portable y puerta de aceptación corporativa

Por petición expresa del responsable (Issue #3), se implementan offline los adaptadores `portable-sharepoint` para los 22 modelos, manteniendo UI Next.js y contratos de repositorio. Electron inicia la aplicación local con autenticación `portable-entra` y persistencia SharePoint; `server-postgres` conserva H9A y `demo` queda limitado a desarrollo. Esta petición autoriza implementación y pruebas sintéticas antes del piloto real H10A, pero no aceptar H10B ni tratar datos corporativos sin IT.

Las escrituras se serializan entre instalaciones mediante bloqueo ETag y journal previo a las mutaciones. Tras error incierto o interrupción se exige reconciliación; no hay recuperación por caducidad del bloqueo ni promesa de transacciones SQL. Las secuencias reservadas no se reutilizan. Los nuevos adjuntos conservan SHA-256. Los límites y procedimiento están en `H10B_SECURITY_AND_RECOVERY.md`.

La aplicación pública con permisos delegados no puede impedir por sí sola llamadas Graph externas ni garantizar autenticidad/inmutabilidad GMP de auditoría. Permisos corporativos efectivos o una autoridad de escritura aprobada son una puerta de aceptación explícita. No se amplían permisos ni se instala esa alternativa de forma automática. Código probado con mocks no equivale a conexión COVEX validada.

## D-064 — H10C: entrega de escritorio y demostración aislada

Por petición expresa del responsable (Issue #5), se entrega una candidata Windows x64 en ZIP con EXE y runtime Electron/Next embebidos, sin instalación de Node, PostgreSQL ni Docker para el usuario. Se conserva la UI y el proveedor H10B de 22 modelos; H9A no cambia. El asistente local carga solo identificadores públicos validados desde el perfil Windows; no admite secretos ni modifica el binario.

El contenido web no recibe el puente privilegiado del asistente. Se mantiene `127.0.0.1:43110` y la URI Entra, se verifica identidad HMAC/PID del proceso propio antes de enviar la cookie efímera, se rechazan Host/Origin ajenos y no se contactan ni terminan servicios ajenos. Tokens y sesiones corporativas permanecen en memoria; el cierre destruye la sesión y termina el proceso propio.

La opción segura autorizada por el Issue es una demo explícita de navegación y generación de anexos ficticios, no una réplica editable: se bloquean mutaciones/importaciones/adjuntos y cualquier API corporativa, no se leen archivos `.data` ni variables corporativas heredadas. No hay promoción ni sincronización de datos demo. El piloto corporativo exige Entra real; no hereda identidad demo.

El resultado técnico de CI no autoriza datos reales ni uso GMP. Siguen abiertos D-063 y los bloqueos de permisos efectivos Graph, auditoría, reconciliación y recuperación. Firma de código, Windows físico/usuario estándar, AV, MFA y aceptación de dos usuarios/dos equipos requieren IT y Calidad. Sin actualización remota automática ni firma con credenciales inventadas.

## D-065 — H10D: demo interactiva exclusivamente en memoria

Por petición expresa del responsable (Issue #7), se sustituye únicamente la condición de solo lectura de la demo Windows de D-064. Se permiten alta/edición de formación y sesión, alta de persona ficticia, gestión de asistentes, finalización de resultados y reapertura motivada para corregirlos. Se reutilizan formularios, validaciones, permisos, repositorios y documentos existentes; no se cambian modelos ni reglas funcionales.

En `PORTABLE_DESKTOP_MODE=demo`, el almacén JSON no lee ni escribe: los repositorios y su auditoría solo conservan sus arrays de proceso. Cada nuevo servicio reconstruye la semilla sintética y sus contadores; no hay exportación/importación ni promoción corporativa. Solo se descargan expresamente documentos sintéticos (Anexos III/IV/V y registro de formadores existente); esos archivos voluntarios no son persistencia de la aplicación.

Una allowlist exacta por método/ruta en servidor limita las mutaciones. Siguen denegados importaciones, adjuntos, controles/cierre documental, administración no necesaria y todas las API portable corporativas. Se conservan host/cookie/Origin y aislamiento de red/entorno/lifecycle H10C. La modalidad corporativa H10C, los 22 adaptadores H10B, H9A y el original no se alteran. La prueba nativa ejecuta el ZIP extraído, descarga el PDF y reinicia el EXE completo para verificar ausencia de registros.

**NO-GO corporativo / GMP** se mantiene: las pruebas sintéticas o Windows CI no validan Entra/SharePoint reales, permisos, auditoría ni recuperación con COVEX.
