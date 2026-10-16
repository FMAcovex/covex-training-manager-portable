# COVEX Training Manager — Operación y recuperación · H9A

Los comandos se ejecutan desde la raíz del checkout aprobado. Requieren Bash, Docker Compose, acceso del operador y el archivo privado `deploy/.env.production`. No usar `down -v` en producción: elimina el volumen de PostgreSQL.

## Salud y logs

```bash
docker compose --env-file deploy/.env.production -f docker-compose.production.yml ps
docker compose --env-file deploy/.env.production -f docker-compose.production.yml logs --tail 100 app
```

El health interno comprueba configuración y conectividad PostgreSQL. El estado OAuth2/Entra, expiración del secreto, certificado, recursos y disponibilidad externa requieren supervisión IT. Docker `unless-stopped` reinicia servicios tras fallos/reinicio del motor; Docker debe arrancar como servicio del host. Una marca `unhealthy` no reinicia por sí sola el contenedor: IT debe definir alertas y respuesta.

Los logs se limitan a 5 archivos de 10 MB por servicio. NGINX registra ruta sin query strings; OAuth2 Proxy deshabilita logs de peticiones y de identidad. No recoger variables resueltas, tokens, secretos, cabeceras de autenticación ni binarios. Restringir acceso y retención a los operadores designados. Mantener los identificadores de correlación de la aplicación para investigar fallos.

## Backup

```bash
bash scripts/deployment/backup.sh
```

Genera un dump PostgreSQL custom, verifica su índice y añade SHA-256. Incluye todas las tablas: perfiles, catálogos, formaciones, sesiones, asistentes, plantillas, numeradores, importaciones, auditoría y adjuntos binarios. Es una instantánea consistente de la BD; los PDFs descargados/impresos conservados fuera de la aplicación y el repositorio documental externo tienen su propio circuito.

La carpeta `backups/` tiene permisos restringidos y está excluida de Git e imágenes. **Un dump en el mismo servidor no cubre su pérdida física**: IT debe copiarlo a destino externo protegido/cifrado, definir frecuencia, retención, RPO/RTO, permisos y monitorizar cada ejecución. No hay automatización programada ni envío externo implementados en H9A.

Conservar también commit/imagen aprobada, configuración privada, certificados, claves y documentación operativa en ubicaciones corporativas protegidas. Los dumps no incluyen secretos del host ni el registro Entra. Redis no necesita copia: sus sesiones son temporales.

## Prueba de restauración sin sobrescribir producción

```bash
bash scripts/deployment/restore-check.sh backups/<archivo>.dump
```

Verifica SHA-256, crea una BD temporal con nombre propio, restaura con parada ante errores, consulta tablas relevantes y elimina exclusivamente esa base temporal. Nunca apunta al nombre productivo. Este control técnico debe acompañarse de una restauración funcional en otro entorno: conectar una copia de la misma versión de aplicación, comprobar anexos, relaciones, contadores, auditoría y descarga de adjuntos; registrar fecha, resultado y tiempo empleado.

## Actualizar

1. Acordar ventana sin usuarios y anotar commit/imagen actual, volumen y backup.
2. Obtener el checkout de la nueva versión aprobada y cambiar `APP_IMAGE` a una etiqueta nueva; no reutilizar etiquetas ni usar `latest` para la aplicación.
3. Ejecutar:

```bash
bash scripts/deployment/update.sh
```

Hace backup, construye la imagen, detiene acceso y app, aplica migraciones y arranca la versión nueva. Si un paso falla, permanece detenido en ese punto y el operador debe investigar; no reabrir el servicio sin controles. No cambia las reglas de negocio ni reimporta datos.

4. Comprobar salud, login, roles, expedientes, anexos y adjuntos antes de comunicar disponibilidad.

Las imágenes de infraestructura están fijadas por versión/serie en Compose. IT debe revisar actualizaciones de seguridad y registrar digests en cada despliegue aprobado para poder reproducirlas; el paquete no instala actualizaciones automáticamente.

## Recuperación / rollback

No existe un downgrade automático de migraciones. Arrancar una imagen antigua sobre un esquema nuevo puede ser incompatible. Elegir según el incidente:

- Fallo de aplicación sin cambio de esquema incompatible: tras revisar compatibilidad, volver a la etiqueta anterior de la aplicación y ejecutar `up -d --wait app gateway` con la configuración aprobada.
- Fallo de esquema o pérdida de datos: cerrar acceso, preservar la BD afectada, crear un PostgreSQL/volumen **nuevo**, restaurar el dump con `pg_restore --exit-on-error --no-owner --no-acl` y arrancar la imagen que corresponde al backup. Comprobar funcionalmente en el entorno aislado antes de conmutar la URL/red.

Ejemplo de restauración en un PostgreSQL **nuevo y aislado**, ya provisionado por IT:

```bash
sha256sum -c backups/<archivo>.dump.sha256
# SUSTITUIR <contenedor-nuevo> y <usuario/base-nueva>; no usar el PostgreSQL productivo.
docker exec -i <contenedor-nuevo> pg_restore -U <usuario> -d <base-nueva> \
  --exit-on-error --no-owner --no-acl < backups/<archivo>.dump
```

IT registrará los cambios posteriores al backup que deban reconciliarse, el RPO efectivo, el tiempo de recuperación y la aceptación GC. Conservar el original para investigación; la recuperación no implica borrar históricos ni fabricar evidencias.

## Rotaciones

- Secreto Entra: emitir el nuevo valor, actualizar configuración privada y recrear OAuth2 Proxy; probar login y retirar el anterior según IT.
- `AUTH_PROXY_SECRET`: actualizarlo y recrear app + gateway coordinadamente; no mantener valores discordantes.
- Cookie secret: cambiarlo y recrear OAuth2 Proxy, provocando nuevo login de usuarios.
- Certificado: renovar archivos montados, ejecutar `nginx -t` y recargar gateway; comprobar cadena/nombre/fecha desde un PC COVEX.
- Contraseña PostgreSQL: cambiarla dentro de PostgreSQL y actualizar configuración de app/migraciones; modificar solo el `.env` no cambia la contraseña de un volumen ya inicializado.
