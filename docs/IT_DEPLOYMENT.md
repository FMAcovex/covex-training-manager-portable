# COVEX Training Manager — Guía de implantación privada · H9A

Entrada del paquete: `docs/IT_HANDOFF_CHECKLIST.md`. Arquitectura: `docs/ARCHITECTURE_FOR_IT.md`. Operación y recuperación: `docs/IT_OPERATIONS.md`.

## 1. Requisitos y decisiones de IT

Servidor privado con Docker Engine y Compose v2 (compatible con `up --wait`), contenedores Linux, Bash, Node.js 22 para los scripts de preparación, HTTPS corporativo, DNS estable, salida HTTPS hacia Entra y reloj sincronizado. Node solo es necesario en el host para preparar/comprobar variables; la aplicación se ejecuta en el contenedor. No se instala en los PC de cada usuario. La construcción inicial de imágenes necesita acceso a los registros de contenedores, npm y paquetes Debian; IT puede realizarla en un entorno autorizado. El runtime incluye pnpm y no debe descargarlo al arrancar o ejecutar migraciones.

El repositorio contiene ejemplos, nunca credenciales corporativas. IT fijará SO, URL y puerto, IP/red de publicación, certificado, recursos, permisos del operador y responsable de mantenimiento. La ruta principal empaqueta PostgreSQL en el mismo host. Un PostgreSQL externo exige adaptar Compose y su política TLS antes de usar esa variante.

## 2. Registro Microsoft Entra

1. Registrar una aplicación web **de un único tenant COVEX**.
2. Registrar exactamente `https://<URL-aprobada>/oauth2/callback` como redirect URI; incluir puerto si no es 443.
3. Obtener tenant ID y client ID. Crear el secreto de cliente y gestionar vencimiento/rotación según IT. No compartirlo por chat ni incluirlo en Git.
4. Aplicar la política corporativa de asignación de usuarios y MFA/Conditional Access. El paquete no solicita grupos ni permisos SharePoint/Graph.
5. Usar `oid` de cada usuario del tenant COVEX en el perfil interno. Un usuario de Entra sin perfil activo no tiene acceso.

Se emplean OAuth2 Proxy 7.15.5 y OIDC, con emisor del tenant específico y validación de firma/audiencia/expiración adicional en la aplicación. No desactivar las comprobaciones de firma, issuer, nonce ni TLS. El login completo con el tenant real se prueba en H9B.

## 3. Preparar configuración

Desde el checkout del commit aprobado:

```bash
node scripts/deployment/init-env.mjs
```

Crea `deploy/.env.production` con permisos 600 y tres secretos aleatorios nuevos, sin mostrarlos y sin sobrescribir un archivo existente. Completar las variables del ejemplo `deploy/production.env.example`:

| Variable | Valor esperado |
| --- | --- |
| `APP_IMAGE` | Etiqueta propia e inmutable de la versión aprobada, por ejemplo `covex-training-manager:h9a-<commit>` |
| `PUBLIC_HOST` | Nombre DNS sin esquema ni puerto |
| `APP_PUBLIC_URL` | URL HTTPS completa, sin ruta; puerto coherente con `HTTPS_PORT` |
| `BIND_ADDRESS` | IP del servidor aprobada por IT; inicialmente loopback |
| `HTTPS_PORT` | 443 o puerto aprobado |
| `TLS_DIRECTORY` | Directorio del host, relativo a la raíz del proyecto o absoluto |
| `ENTRA_TENANT_ID` / `ENTRA_CLIENT_ID` | UUID corporativos |
| `ENTRA_CLIENT_SECRET` | Secreto del registro de aplicación |
| `POSTGRES_DB` / `POSTGRES_USER` | Nombres técnicos PostgreSQL |
| `POSTGRES_PASSWORD` / `AUTH_PROXY_SECRET` | Secretos hexadecimales de 32 bytes generados |
| `OAUTH2_PROXY_COOKIE_SECRET` | 32 bytes aleatorios en base64url |

Guardar `fullchain.pem` y `privkey.pem` en `TLS_DIRECTORY`. El certificado debe corresponder a la URL y ser confiable para los navegadores. Aplicar permisos restringidos a clave y configuración; conservar copias protegidas para recuperación. No ejecutar `docker compose config` sin `--quiet` en canales compartidos: puede mostrar variables resueltas.

## 4. Instalar

```bash
bash scripts/deployment/deploy.sh
```

Comprueba configuración y archivos TLS, valida Compose sin imprimir secretos, construye la imagen, inicia PostgreSQL/Redis, aplica migraciones y arranca aplicación, autenticación y HTTPS. Comprueba salud del backend y sintaxis NGINX. Un error detiene el procedimiento; no existe fallback demo. No ejecuta seed, no importa históricos y no decide las plantillas de producción.

Para un archivo de configuración alternativo, establecer `COVEX_DEPLOY_ENV=/ruta/segura/.env.production`. Usar siempre el mismo archivo y nombre de proyecto; cambiarlo inadvertidamente puede seleccionar otro volumen.

## 5. Primer administrador

Preparar temporalmente las variables en la sesión del operador, con el usuario designado por COVEX:

```bash
export BOOTSTRAP_ADMIN_ENTRA_OBJECT_ID='<oid-del-usuario>'
export BOOTSTRAP_ADMIN_EMAIL='<correo-corporativo>'
export BOOTSTRAP_ADMIN_DISPLAY_NAME='<nombre>'
docker compose --env-file deploy/.env.production -f docker-compose.production.yml run --rm \
  -e BOOTSTRAP_ADMIN_ENTRA_OBJECT_ID -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_ADMIN_DISPLAY_NAME \
  app pnpm db:bootstrap-admin
unset BOOTSTRAP_ADMIN_ENTRA_OBJECT_ID BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_DISPLAY_NAME
```

Ejecutar una única vez y con un único operador. Si ya existe un ADMIN activo, el comando no realiza cambios. Después se gestionan usuarios desde Administración. La aplicación no recibe el secreto de cliente de Entra: lo utiliza únicamente el proxy de autenticación.

## 6. Preparación y aceptación

Entrar con Entra, completar perfiles/catálogos mediante Administración y confirmar con GC las versiones de plantilla vigentes antes de emitir registros. El seed contiene expedientes y usuarios ficticios y está bloqueado en producción. Las plantillas soportadas actualmente están identificadas como fixtures en el código; su registro/aceptación documental debe quedar resuelto en la implantación, sin convertirlas automáticamente en plantillas corporativas aprobadas.

No copiar los JSON `.data` de demo a PostgreSQL ni dar por migrados los históricos: H9C verificará fuentes y correspondencias en el procedimiento acordado. Las pruebas y el manual ya realizados sirven de base, pero no acreditan por sí solos el login, red, backup ni aceptación de esta instalación.

Health interno:

```bash
docker compose --env-file deploy/.env.production -f docker-compose.production.yml exec -T app \
  node -e "fetch('http://localhost:3000/api/health').then(async r=>{console.log(r.status,await r.json());if(!r.ok)process.exit(1)})"
```

El gateway protege `/api/health` como las demás API; la salud del contenedor se consulta internamente. Un HTTP 200 confirma configuración y BD, no una sesión Entra válida. Completar `IT_HANDOFF_CHECKLIST.md` antes de abrir servicio.

Referencias técnicas: [OAuth2 Proxy / Entra](https://oauth2-proxy.github.io/oauth2-proxy/configuration/providers/ms_entra_id/), [NGINX auth_request](https://oauth2-proxy.github.io/oauth2-proxy/configuration/integrations/nginx/), [Microsoft: claims del ID token](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference).
