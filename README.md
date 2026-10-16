# COVEX Training Manager

Aplicación web interna para gestionar formaciones, sesiones, asistentes, documentación, planes anuales e historiales individuales.

## Origen de esta distribución portable

Este repositorio comenzó como un snapshot revisado de
`FMAcovex/covex-training-manager` en el commit
`b2414e3f7f702e0bd896a32e67b4e5fcd82789a4`. Mantiene un historial Git
independiente y no contiene el historial privado del repositorio de origen.
La revisión previa a su publicación está documentada en
[`docs/PUBLIC_SNAPSHOT.md`](docs/PUBLIC_SNAPSHOT.md).

## Desarrollo y demostración

La aplicación conserva un modo demo para desarrollo y presentación a IT. No necesita Azure, Entra ni PostgreSQL para mostrar la interfaz y los flujos principales.

1. Copiar .env.example a .env.
2. Mantener APP_ENV=development y AUTH_MODE=demo.
3. Ejecutar pnpm install.
4. Ejecutar pnpm db:generate.
5. Ejecutar pnpm dev.

En modo demo se usan únicamente datos ficticios. Personas, catálogos, formaciones, sesiones, asistencias y auditoría se conservan localmente bajo `.data/` para facilitar demostraciones entre reinicios. Algunos módulos auxiliares, como determinadas evidencias documentales generadas en memoria, pueden reiniciarse con el proceso; la demo no debe tratarse como almacenamiento productivo.

## Preparación de producción

Producción requiere autenticación corporativa Microsoft Entra. El modo servidor H9A usa PostgreSQL; la edición H10B usa SharePoint y no necesita PostgreSQL ni servidor privado para el usuario. IT debe configurar y comprobar el tenant real antes de abrir acceso.

- `PERSISTENCE_PROVIDER=server-postgres` exige PostgreSQL; `portable-sharepoint` lo sustituye por Microsoft Graph.
- AUTH_MODE=app-service usa la identidad autenticada por Azure App Service y solo es válido detrás de ese perímetro.
- AUTH_MODE=entra-proxy utiliza el gateway OIDC con JWT verificado para el servidor privado de H9A.
- La aplicación no gestiona contraseñas.
- Los roles USER / RESPONSIBLE / ADMIN se resuelven desde UserProfile.
- /api/health comprueba configuración y base de datos.
- SharePoint permanece opcional.

La receta de implantación para IT está en docs/IT_DEPLOYMENT.md.

## Calidad

Ejecutar pnpm quality para generación Prisma, lint, tests, build y validación reproducible de anexos.

## H10A · prototipo portable Windows + SharePoint

H10A añade una prueba vertical independiente en `/portable-poc`: conserva la interfaz Next.js, se empaqueta con Electron para Windows y usa autenticación delegada de Microsoft Entra (MSAL, Authorization Code + PKCE) para acceder a una lista y una biblioteca de SharePoint mediante Microsoft Graph. No sustituye todavía PostgreSQL ni activa el conjunto completo de módulos.

1. Copiar `.env.example` a `.env.local` y completar únicamente los identificadores públicos indicados en [`docs/H10A_IT_REQUIREMENTS.md`](docs/H10A_IT_REQUIREMENTS.md).
2. Ejecutar `pnpm portable:dev` para la aplicación de escritorio local.
3. Ejecutar `pnpm portable:verify` para las pruebas simuladas de Graph/SharePoint.
4. Ejecutar `pnpm portable:package:win` para generar el paquete x64 en `dist-portable/`.

El análisis de los 22 modelos y la frontera de la prueba están en [`docs/H10A_PORTABLE_AUDIT.md`](docs/H10A_PORTABLE_AUDIT.md). Los resultados y limitaciones se registran en [`docs/H10A_RESULT.md`](docs/H10A_RESULT.md).

## H10B · edición portable completa

H10B conecta los repositorios funcionales a 22 listas SharePoint y la documentación a una biblioteca, manteniendo los flujos y reglas existentes. Añade autenticación portable real, roles, auditoría, concurrencia ETag, numeración, operaciones reconciliables, importaciones, formadores cualificados, integridad y Anexos III/IV/V.

- Resultado y matriz 22/22: [`docs/H10B_RESULT.md`](docs/H10B_RESULT.md).
- Configuración, permisos y piloto obligatorio: [`docs/H10B_IT_REQUIREMENTS.md`](docs/H10B_IT_REQUIREMENTS.md).
- Plan de listas sin cambios: `PORTABLE_SHAREPOINT_SITE_ID=... pnpm portable:provision:dry-run`.

La conexión con COVEX continúa no validada hasta completar el piloto de IT; el modo demo nunca se usa para datos corporativos.

## Entrega a IT

- `docs/DEMO_FOR_IT.md`: guion para presentar la aplicación.
- `docs/ARCHITECTURE_FOR_IT.md`: arquitectura de referencia.
- `docs/IT_HANDOFF_CHECKLIST.md`: checklist de aprovisionamiento y aceptación.
- `docs/IT_DEPLOYMENT.md`: receta técnica de implantación.


## Despliegue sin Azure

Si IT no dispone de Azure App Service, la aplicación dispone de un empaquetado Docker portable para demo y un Compose productivo para servidor privado. La guía está en `docs/HOSTING_WITHOUT_AZURE.md`.

La autenticación Entra del paquete debe configurarse y comprobarse con IT antes de abrir acceso a usuarios reales; `AUTH_MODE=demo` nunca debe utilizarse en producción.

## H9A · Implantación en servidor privado

El paquete productivo se inicia desde [la guía IT](docs/IT_DEPLOYMENT.md) y [su checklist](docs/IT_HANDOFF_CHECKLIST.md). Incluye Docker Compose, PostgreSQL persistente, gateway HTTPS, Microsoft Entra mediante OAuth2 Proxy y validación JWT en la aplicación, scripts de backup/restauración y pruebas técnicas automatizadas. Azure no es necesario. La conexión corporativa y la aceptación de la instalación corresponden a H9B–H9D.
