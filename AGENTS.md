# AGENTS.md — COVEX Training Manager

## Misión

Construir y mantener una aplicación web interna para la gestión de formaciones de COVEX conforme a los requisitos de `/docs`.

## Fuentes de verdad

Antes de modificar comportamiento funcional, leer:

1. `docs/SPECIFICATION.md`
2. `docs/DECISIONS.md`
3. `docs/WORKFLOWS.md`
4. `docs/DATA_MODEL.md`
5. `docs/ANNEX_RULES.md`
6. `docs/PERMISSIONS.md`
7. `docs/CURRENT_STATUS.md`

Si existe conflicto entre documentos, `DECISIONS.md` prevalece para decisiones cerradas y `SPECIFICATION.md` para alcance funcional general. No inventar una regla de negocio para resolver un conflicto: documentarlo y detener la implementación afectada hasta aclararlo.

## Reglas funcionales innegociables

- Una `Formación` puede contener una o varias `Sesiones`.
- Una Formación con varias Sesiones solo es `EJECUTADA` cuando todas sus Sesiones previstas están `EJECUTADAS`.
- Estado de ejecución y estado documental son independientes.
- Una Sesión puede estar `EJECUTADA` con documentación `PENDIENTE`.
- Los tres controles documentales son:
  1. Anexo III firmado.
  2. Contenido / presentación / material archivado.
  3. Evaluaciones / exámenes archivados.
- Los controles documentales no bloquean el paso de una Sesión a `EJECUTADA`.
- Una Sesión ya ejecutada solo puede ser modificada por un `ADMINISTRADOR`.
- El personal puede ser `INTERNO` o `EXTERNO`; ambos pueden conservarse en el maestro de personal.
- Los asistentes no pueden duplicarse dentro de una misma Sesión.
- El resultado individual admite como mínimo `APTO` y `NO_APTO`.
- Un `NO_APTO` permanece en el historial individual y puede dar lugar a refuerzo, repetición o reentrenamiento.
- En formación no planificada, el motivo es obligatorio.
- En formación planificada, el motivo puede quedar vacío.
- Para formaciones internas, método de evaluación y criterio de aptitud forman parte de los datos de la formación/sesión y deben quedar definidos antes de la impartición. Esto es independiente del check posterior de archivo de evaluaciones.

## Anexos controlados

- Anexo III: Registro de asistencia y evaluación de sesión formativa.
- Anexo IV: Plan de Formación Anual.
- Anexo V: Resumen Individual de Formaciones.

Las plantillas aprobadas son documentos controlados. La aplicación debe cumplimentarlas, no rediseñarlas.

Nunca cambiar de forma automática:

- tipografías;
- colores;
- color de fuente;
- bordes;
- textos fijos;
- identificación de anexo/PNT;
- estructura visual aprobada.

Una nueva versión del PNT debe incorporarse como nueva versión de plantilla sin alterar documentos históricos ya generados.

## Arquitectura

Objetivo inicial:

- Next.js + TypeScript + React.
- PostgreSQL.
- Prisma.
- Microsoft Entra ID.
- Azure App Service.
- Plantillas controladas alojadas en SharePoint.
- Repositorio cloud privado.

Mantener módulos separados para auth, personal, formaciones, sesiones, asistencia, documentación, plan anual, anexos, administración y auditoría.

## Cloud-first

La aplicación no debe depender de carpetas locales ni de almacenamiento permanente en el ordenador del usuario. Archivos temporales usados para generar documentos deben eliminarse después de completar la operación.

## Calidad de desarrollo

Para cada cambio:

- implementar validaciones en servidor además de cliente;
- añadir o actualizar pruebas;
- ejecutar lint;
- ejecutar tests;
- comprobar build;
- no introducir secretos en código o repositorio;
- usar variables de entorno para configuración;
- actualizar `docs/CURRENT_STATUS.md`;
- actualizar `docs/DECISIONS.md` si se toma una nueva decisión estructural o funcional.

No continuar al siguiente hito sin que el hito actual tenga pruebas satisfactorias.

## Seguridad y permisos

- Denegación por defecto para operaciones no autorizadas.
- No confiar únicamente en ocultar botones en la interfaz: aplicar permisos en servidor.
- Solo Administrador puede modificar una Sesión ejecutada.
- Registrar acciones relevantes en el historial interno.

## Datos de prueba

Durante desarrollo usar exclusivamente datos ficticios salvo instrucción expresa. Nunca añadir información personal real de empleados al repositorio.

## Alcance inicial

No implementar en V1 salvo instrucción expresa:

- firma electrónica;
- sustitución del registro oficial en papel;
- carga documental obligatoria;
- IA para interpretar textos libres;
- indicadores avanzados;
- automatizaciones de correo;
- módulo del Libro de Formaciones Iniciales.
