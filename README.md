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

Producción requiere PostgreSQL y autenticación corporativa Microsoft Entra. Azure App Service sigue siendo un escenario soportado, pero no es obligatorio: la aplicación también dispone de empaquetado Docker para un servidor/VM interno. H9A incorpora Entra por proxy OIDC para servidor privado; IT debe configurar y comprobar el tenant real antes de abrir acceso.

- APP_ENV=production obliga a usar PostgreSQL.
- AUTH_MODE=app-service usa la identidad autenticada por Azure App Service y solo es válido detrás de ese perímetro.
- AUTH_MODE=entra-proxy utiliza el gateway OIDC con JWT verificado para el servidor privado de H9A.
- La aplicación no gestiona contraseñas.
- Los roles USER / RESPONSIBLE / ADMIN se resuelven desde UserProfile.
- /api/health comprueba configuración y base de datos.
- SharePoint permanece opcional.

La receta de implantación para IT está en docs/IT_DEPLOYMENT.md.

## Calidad

Ejecutar pnpm quality para generación Prisma, lint, tests, build y validación reproducible de anexos.

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
