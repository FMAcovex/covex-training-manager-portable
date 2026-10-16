# Primer encargo para Codex

## Proyecto

COVEX Training Manager

## Instrucción

Lee `AGENTS.md` y todos los archivos de `/docs` antes de modificar código. Trátalos como la especificación del proyecto.

Construye únicamente los cimientos del proyecto correspondientes al `Hito 0 — Cimientos` de `docs/ROADMAP.md`.

## Tecnología objetivo

- Next.js
- TypeScript
- React
- PostgreSQL
- Prisma
- Azure App Service como destino futuro
- Microsoft Entra ID como autenticación futura

## En esta tarea implementar

1. Estructura inicial del proyecto.
2. Configuración de TypeScript, lint y test.
3. Prisma con el modelo mínimo necesario para:
   - Person
   - Department
   - UserProfile
   - roles USER / RESPONSIBLE / ADMIN
4. Módulo `Personal` con:
   - listado;
   - alta;
   - edición;
   - activación/desactivación;
   - tipo INTERNO/EXTERNO;
   - departamento, puesto y empresa cuando aplique.
5. Navegación base de la aplicación con secciones futuras visibles pero no funcionales:
   - Inicio
   - Formaciones
   - Nueva formación
   - Plan anual
   - Personal
   - Documentación
   - Administración
6. Datos ficticios de seed.
7. Pruebas del modelo de datos y validaciones principales de Personal.

## No implementar todavía

- Formaciones.
- Sesiones.
- Asistencias.
- Anexos.
- Generación PDF.
- SharePoint real.
- Entra ID real.
- Envío de correo.
- IA.

Para autenticación durante el prototipo, crear una abstracción clara que permita simular un usuario/rol sin acoplar la aplicación a un sistema de login local definitivo.

## Requisitos de arquitectura

- Organizar por módulos.
- No almacenar secretos en el repositorio.
- Usar variables de entorno con `.env.example`.
- No depender de almacenamiento local permanente del usuario.
- Las autorizaciones deberán diseñarse para validarse en servidor.
- Mantener separación entre lógica de dominio e interfaz.

## Proceso

Antes de codificar:

1. Explica brevemente el plan de implementación.
2. Identifica cualquier contradicción que encuentres en los documentos.
3. Si no hay contradicciones bloqueantes, implementa el Hito 0.

Al finalizar:

1. Ejecuta lint.
2. Ejecuta tests.
3. Ejecuta build.
4. Corrige los errores encontrados.
5. Resume los archivos principales creados.
6. Actualiza `docs/CURRENT_STATUS.md` con el estado real.
7. Añade a `docs/DECISIONS.md` únicamente decisiones técnicas nuevas que sean relevantes para el futuro.
8. No avances al Hito 1 sin autorización explícita.
