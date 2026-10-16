# COVEX Training Manager — Entrega a IT · H9A

## Estado y alcance

Manual y pruebas funcionales realizados según confirmación del responsable. H9A prepara una única PR con despliegue privado, PostgreSQL, Entra y operación. La infraestructura corporativa y su aceptación siguen pendientes. SharePoint, indicadores avanzados, alertas, firma e integración QMS quedan para futuro.

Leer en este orden: `ARCHITECTURE_FOR_IT.md`, `IT_DEPLOYMENT.md`, `IT_OPERATIONS.md`. Código ejecutable: `Dockerfile`, `docker-compose.production.yml`, `deploy/` y `scripts/deployment/`.

## Información pendiente de IT

| Decisión | Valor / responsable / fecha |
| --- | --- |
| SO y plataforma para contenedores Linux | Pendiente |
| CPU/RAM/disco, capacidad y crecimiento de adjuntos | Pendiente |
| URL interna, DNS, IP y puerto de publicación | Pendiente |
| Certificado HTTPS, renovación y permisos de clave | Pendiente |
| Tenant, aplicación Entra, asignaciones y política MFA | Pendiente |
| Salida HTTPS a Entra y sincronización horaria | Pendiente |
| PostgreSQL local del paquete o variante corporativa externa con TLS | Pendiente |
| Copias externas, retención, cifrado, RPO y RTO | Pendiente |
| Logs, vigilancia de salud, mantenimiento y contacto de soporte | Pendiente |
| Primer ADMIN y responsables de perfiles | Pendiente |

El paquete ofrece una ruta concreta con NGINX + OAuth2 Proxy. Si IT requiere otro gateway/OIDC directo, revisar su integración antes del despliegue; las cabeceras sin token verificado no bastan para identificar usuarios.

## H9A — Criterios técnicos

- [ ] Revisión sobre main y documentación actualizada.
- [ ] Pruebas de firma JWT, claims, secreto, fallos y compatibilidad demo/App Service.
- [ ] Lint, tests, build y generación/validación de anexos satisfactorios.
- [ ] CI: imagen, migraciones vacías, runtime productivo y arranque demo productivo rechazado.
- [ ] CI: HTTPS, rechazo de cabeceras falsificadas y token inválido, persistencia tras reinicio.
- [ ] CI: dump/restauración en una BD temporal sin sustituir la productiva.
- [ ] Sin credenciales ni datos personales reales en la PR.

La CI sustituye únicamente la frontera del proveedor de identidad en el smoke Docker; valida firma/claims con claves sintéticas en las pruebas de aplicación. No acredita un inicio de sesión real en Entra, MFA, certificado corporativo ni validación GMP.

## H9B–H9D — Aceptación de la instalación

Registrar commit desplegado, fecha, operador, evidencias y resultado de cada punto:

- [ ] SO, servicios y reinicio automático verificados tras reinicio del host.
- [ ] DNS/HTTPS accesibles desde los PC autorizados; certificado confiable y renovación definida.
- [ ] Sin acceso de red directo a app, PostgreSQL, Redis ni OAuth2 Proxy.
- [ ] Inicio de sesión Entra correcto en tenant COVEX; MFA/asignaciones según IT.
- [ ] Usuario sin perfil y perfil inactivo denegados; roles USER/RESPONSIBLE/ADMIN comprobados.
- [ ] Primer ADMIN creado; variables temporales retiradas.
- [ ] Catálogos y plantillas aceptados por GC; sin usuarios/expedientes demo.
- [ ] Datos/históricos migrados y reconciliados según H9C; códigos y relaciones conservados.
- [ ] Formación/Sesión y cambios persisten tras reinicio.
- [ ] Selecciones múltiples, ejecución y cierre/reapertura conservan comportamiento aprobado.
- [ ] Anexos III/IV/V y DOCX de Formadores se generan correctamente.
- [ ] Adjuntos de Sesión y Formadores se guardan, descargan y auditan.
- [ ] Backup contiene registros, auditoría y binarios; copia externa y retención operativas.
- [ ] Restauración aislada y recuperación funcional con imagen compatible comprobadas.
- [ ] Salud, logs, alertas operativas y vencimiento del secreto/certificado atendidos por IT.
- [ ] Incidencias registradas y aceptación IT/GC firmada conforme al circuito aplicable.

H9A no cierra la puesta en servicio ni la validación de la instalación. Responsable operativo: pendiente de designación IT. Responsable de aceptación funcional/documental: COVEX/GC.
