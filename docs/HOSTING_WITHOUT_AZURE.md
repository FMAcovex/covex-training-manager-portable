# Alojamiento sin Azure

La ruta preparada en H9A usa el servidor privado de COVEX con contenedores Linux, NGINX HTTPS, OAuth2 Proxy conectado a Microsoft Entra y PostgreSQL persistente. Azure no es obligatorio. SO, URL, certificado y red definitivos están pendientes de IT.

Seguir `ARCHITECTURE_FOR_IT.md`, `IT_DEPLOYMENT.md`, `IT_OPERATIONS.md` e `IT_HANDOFF_CHECKLIST.md`. El paquete concreto es `docker-compose.production.yml`; `docker-compose.demo.yml` sigue siendo exclusivamente una demostración con datos ficticios.

No utilizar `AUTH_MODE=app-service` en un servidor privado ni confiar en cabeceras enviadas por el cliente. `AUTH_MODE=entra-proxy` exige token Entra firmado, validado en servidor, tenant/audiencia correctos y perfil activo.

Si IT selecciona ejecución Node.js sin contenedores, otro gateway corporativo o PostgreSQL externo, deberá adaptar y verificar esa ruta antes de apertura. La propuesta portable no acredita automáticamente plataformas distintas a la probada por CI. SharePoint y otras mejoras funcionales permanecen para futuro.
