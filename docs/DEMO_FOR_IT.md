# Demo para IT — COVEX Training Manager

## Objetivo

Mostrar una aplicación funcional y técnicamente preparada antes de solicitar infraestructura corporativa.

La demo utiliza datos ficticios y no necesita Azure, Microsoft Entra, PostgreSQL ni acceso a SharePoint. Los flujos que se enseñan son los mismos que se utilizarán tras la implantación.

## Mensaje de apertura recomendado

> COVEX Training Manager ya está desarrollado y los flujos funcionales están probados. La reunión no busca que IT desarrolle la aplicación, sino validar y proporcionar la infraestructura corporativa necesaria para desplegarla de forma controlada.

## Duración recomendada

10–15 minutos de demostración y 10 minutos para requisitos de implantación.

## Preparación antes de la reunión

- confirmar que `main` tiene CI satisfactorio;
- usar `APP_ENV=development` y `AUTH_MODE=demo`;
- no configurar `DATABASE_URL` si se quiere una demo exclusivamente en memoria;
- ejecutar `pnpm install`, `pnpm db:generate` y `pnpm dev`;
- abrir la aplicación y comprobar Formaciones, Plan anual, Personal, Documentación y Administración;
- generar al menos un Anexo III antes de la reunión para confirmar la descarga PDF;
- mantener abierto `docs/ARCHITECTURE_FOR_IT.md` para explicar la arquitectura si surge la pregunta.

## Recorrido recomendado

### 1. Inicio — 1 minuto

Explicar:

- es una aplicación web interna independiente;
- SharePoint no aloja la aplicación;
- los datos visibles son ficticios;
- la versión demo y la productiva comparten los mismos flujos.

### 2. Formación y Sesiones — 4 minutos

Abrir **Buenas prácticas en zona controlada**.

Mostrar:

- ficha de Formación;
- formación planificada y datos GMP;
- varias Sesiones para una misma Formación;
- Sesión ejecutada y Sesión pendiente;
- asistentes y resultados;
- generación del Anexo III.

Mensaje clave: la Formación agrupa el objetivo formativo y las Sesiones representan cada ejecución real.

### 3. Plan anual y Anexo IV — 2 minutos

Mostrar:

- formaciones planificadas y no planificadas;
- estados pendientes, ejecutadas y no ejecutadas;
- justificación de no ejecución;
- generación del Anexo IV.

### 4. Personal e historial — 2 minutos

Mostrar:

- personal interno y externo;
- histórico individual;
- resultado No Apto de ejemplo;
- Anexo V;
- conservación de históricos incluso para personal inactivo.

### 5. Documentación — 2 minutos

Mostrar:

- Anexo III firmado;
- material de formación;
- evidencia de evaluación;
- ejemplo parcial y ejemplo completo;
- cola de documentación pendiente.

### 6. Administración y trazabilidad — 2 minutos

Mostrar:

- perfiles USER / RESPONSIBLE / ADMIN;
- catálogos;
- versiones de plantilla;
- AuditEvent.

Explicar que Microsoft Entra autentica al usuario y COVEX Training Manager decide su rol dentro de la aplicación.

### 7. Paso a producción — 1 minuto

Explicar:

- el usuario demo desaparece;
- Microsoft Entra autentica;
- PostgreSQL sustituye la memoria;
- el servidor privado aloja la aplicación mediante Docker;
- SharePoint puede incorporarse después como fuente controlada de plantillas;
- los flujos funcionales no se rediseñan.

## Preguntas previsibles de IT

**¿Dónde se aloja?**  
Servidor privado con contenedores Linux; ver IT_DEPLOYMENT.md.

**¿La aplicación guarda contraseñas?**  
No. H9A delega la autenticación en Microsoft Entra mediante el gateway OIDC y verifica el JWT en la aplicación. El login corporativo real se comprueba con IT.

**¿Dónde quedan los datos?**  
En PostgreSQL administrado en producción.

**¿Es necesario SharePoint para arrancar?**  
No. Es una integración opcional para una fase posterior o para plantillas controladas.

**¿Qué necesita desarrollar IT?**  
Nada de la lógica de negocio. IT debe aprovisionar/configurar infraestructura, secretos, autenticación, logs y backups.

**¿Cómo se comprueba que está operativa?**  
Mediante `/api/health` y el checklist de aceptación.

## Qué no presentar como productivo

- Usuario Demo.
- Datos ficticios.
- Repositorios en memoria.
- Fixtures de plantillas de desarrollo.
- Referencias SharePoint de prueba.

## Cierre recomendado

> Si IT confirma la arquitectura y nos proporciona los recursos indicados en el checklist, el siguiente paso es el Hito 9: conexión a la infraestructura real, pruebas de aceptación y puesta en servicio.
