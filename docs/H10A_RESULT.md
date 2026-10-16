# H10A — resultado y limitaciones

## Entregado

- Aplicación Next.js conservada y ejecutable como escritorio Windows x64 mediante Electron.
- MSAL Browser con cliente público, tenant único y Authorization Code + PKCE.
- Corte vertical de Microsoft Graph para listar, crear, consultar y modificar Formaciones en SharePoint Lists.
- Carga y recuperación de documentos en una biblioteca SharePoint.
- Concurrencia optimista mediante ETag/`If-Match` y respuesta específica ante HTTP 412.
- Paginación segura, errores legibles y reintentos acotados para 429/503/504.
- Pruebas automatizadas con transporte Graph simulado, sin secretos ni acceso corporativo.
- Job Windows de GitHub Actions que verifica las pruebas y genera el artefacto portable.

## Límites deliberados

H10A no migra el modelo completo, no sustituye PostgreSQL en producción, no cambia los flujos existentes ni pretende validar datos reales. El prototipo cubre solo siete campos de Formación y un documento independiente. No incluye sesiones, asistentes, catálogos relacionados, roles COVEX, auditoría completa, importaciones, generación/trazabilidad de anexos ni archivos de más de 4 MB.

No se ha realizado una conexión real al tenant porque este entorno no contiene permisos ni identificadores corporativos. Esa ausencia no se ha sustituido por credenciales ficticias: las pruebas simulan las respuestas relevantes de Graph. La aceptación real corresponde al checklist de [`H10A_IT_REQUIREMENTS.md`](H10A_IT_REQUIREMENTS.md).

## Criterio de continuación

El resultado es **GO condicionado para el piloto corporativo H10A** y **NO-GO para comenzar la migración H10B** hasta completar la prueba real con IT, aprobar el mínimo privilegio y aceptar el diseño de persistencia de los 22 modelos. H10B no se ha iniciado.

## Verificación realizada

- `pnpm quality`: 39 ficheros y 435 pruebas correctas, lint, compilación Next.js y validación de Anexos III/IV/V.
- `pnpm deployment:verify`: 9 pruebas de preflight correctas.
- Arranque del servidor standalone y respuesta correcta de `/api/health`, `/api/portable/config` y `/portable-poc`.
- Generación local del paquete Electron `win32-x64`, con ejecutable y runtime standalone presentes.
- La conexión real a Microsoft 365 y la ejecución interactiva en un equipo Windows corporativo permanecen como aceptación de IT.
