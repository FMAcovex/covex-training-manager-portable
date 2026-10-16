# Roadmap de desarrollo

No intentar construir toda la aplicación en un único encargo.

Estado: Hitos 0–8 aceptados, fusionados y cerrados. Hito 9 reservado para implantación corporativa y aceptación.

## Hito 0 — Cimientos

Objetivo:

- crear repositorio/proyecto;
- configurar Next.js + TypeScript;
- configurar Prisma y modelo inicial;
- navegación básica;
- módulo Personal;
- roles base;
- datos ficticios;
- tests/lint/build.

Criterio de salida:

- proyecto compila;
- tests base pasan;
- CRUD de Personal funciona con datos de prueba;
- roles representados en dominio;
- documentación actualizada.

## Hito 1 — Formaciones

- alta de Formación;
- planificada/no planificada;
- validación de motivo;
- datos GMP, origen, modalidad, material, contenido, evaluación;
- listado y filtros básicos;
- ficha de Formación.

## Hito 2 — Sesiones y asistencia

- una o varias Sesiones;
- asistentes previstos;
- internos/externos;
- prevención de duplicados;
- finalización;
- Asiste/No asiste;
- Apto/No apto;
- cálculo de estado global;
- bloqueo de edición post-ejecución para no Admin.

## Hito 3 — Anexo III

- integrar plantilla controlada de prueba;
- capa de adaptación de plantilla;
- generación cloud;
- PDF;
- validaciones visuales y funcionales;
- paginación/filas dinámicas.

No avanzar hasta que el Anexo III sea estable.

## Hito 4 — Plan anual + Anexo IV

Aceptado, fusionado y cerrado. Se implementó conjuntamente con el Hito 5, conservando ambos como hitos funcionales independientes.

- vista por año;
- planificadas;
- no planificadas;
- no ejecutadas con justificación;
- filtros;
- generación Anexo IV.

## Hito 5 — Historial individual + Anexo V

Aceptado, fusionado y cerrado. Se implementó conjuntamente con el Hito 4, conservando ambos como hitos funcionales independientes.

- ficha de Persona;
- filtro por año;
- histórico;
- No Apto;
- generación Anexo V;
- paginación correcta.

## Hito 6 — Control documental

Aceptado, fusionado y cerrado.

- tres checks;
- estado documental;
- pantalla de pendientes;
- filtros;
- actualización por responsables/admin.

## Hito 7 — Administración y trazabilidad

Aceptado, fusionado y cerrado.

- usuarios/roles;
- catálogos;
- versiones de plantilla;
- AuditEvent;
- vistas administrativas.

## Hito 8 — Preparación para producción

Aceptado, fusionado en `main` y cerrado mediante PR #10. La preparación técnica quedó completada sin requerir todavía infraestructura corporativa real.

Objetivo:

- conservar un modo demo seguro y claramente separado de producción;
- preparar Microsoft Entra mediante autenticación integrada de Azure App Service;
- vincular la identidad corporativa con UserProfile y los roles internos;
- impedir memoria y autenticación demo en producción;
- preparar PostgreSQL con migraciones reproducibles;
- crear de forma segura el primer ADMIN;
- preparar health checks, arranque y variables de entorno;
- preparar CI y comprobaciones de calidad;
- dejar SharePoint como integración opcional y separada;
- documentar para IT infraestructura, secretos, logs, backups y despliegue;
- preparar pruebas de aceptación.

Criterio de salida:

- la rama puede probarse sin recursos corporativos en modo demo;
- producción no puede arrancar accidentalmente sin PostgreSQL o con AUTH_MODE=demo;
- la identidad Entra queda preparada y separada de la autorización interna;
- existe migración inicial y comando de despliegue;
- existe procedimiento de primer ADMIN;
- existe /api/health;
- existe guía de implantación para IT;
- CI ejecuta la suite de calidad;
- quedan identificadas como externas únicamente las conexiones corporativas reales.

## Hito 9 — Implantación corporativa y aceptación

Se ejecutará cuando IT proporcione los recursos corporativos.

- crear/configurar Azure App Service;
- activar Microsoft Entra;
- crear/configurar PostgreSQL;
- introducir secretos y variables reales;
- ejecutar migraciones;
- crear primer ADMIN;
- configurar logs, backups y health check;
- activar SharePoint solo si se aprueba para plantillas;
- ejecutar pruebas de aceptación con usuarios reales;
- corregir incidencias de implantación;
- aprobar puesta en servicio.

El Hito 9 no desarrolla de nuevo la aplicación: conecta y valida la infraestructura real.

## Mejoras posteriores posibles

- carga/archivo digital de documentación;
- recordatorios de documentación pendiente;
- avisos de formaciones próximas;
- indicadores y dashboard avanzado;
- ampliación futura de la importación a otros ejercicios o formatos distintos de la plantilla 2026;
- IA para interpretar listas de formación recibidas en texto libre;
- integración con Libro de Formaciones Iniciales;
- informes adicionales;
- exportaciones masivas.

## Concreción de Hito 9 · implantación privada

- **H9A:** paquete técnico revisable para IT (Docker, PostgreSQL, Entra por proxy, instalación/actualización/recuperación y pruebas). Sin infraestructura ni secretos corporativos.
- **H9B:** instalación con SO/URL/certificado/red acordados; autenticación Entra real y primer ADMIN.
- **H9C:** migración y reconciliación de datos, catálogos y plantillas aceptados por GC.
- **H9D:** aceptación de usuarios/IT/GC, backup/restauración funcional y apertura controlada.

El manual y las pruebas funcionales ya realizados se conservan. SharePoint, QMS, dashboards avanzados, avisos, Libro de Formaciones Iniciales y firma electrónica permanecen en mejoras futuras.
