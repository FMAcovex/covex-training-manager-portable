# H10B — requisitos y piloto obligatorio de IT

## 1. Microsoft Entra

Registrar una aplicación **single tenant** de cliente público. No crear ni entregar secretos de cliente.

- Redirect URI: `http://127.0.0.1:43110/acceso-denegado`.
- Flujo: Authorization Code + PKCE; implicit grant deshabilitado.
- Permisos delegados solicitados por la aplicación: `User.Read` y `Sites.Selected`.
- Conceder a la aplicación acceso de escritura exclusivamente al sitio COVEX seleccionado, mediante el procedimiento administrativo de permisos de sitio de Microsoft Graph.
- Aplicar MFA, Conditional Access y política de dispositivo corporativo según IT.

Si el tenant no admite `Sites.Selected` delegado con el alcance requerido, IT debe detener el piloto y documentar la alternativa de mínimo privilegio. No se debe sustituir automáticamente por `Sites.ReadWrite.All`.

Antes de autorizar datos corporativos, revisar el bloqueo de confianza y la matriz de permisos efectivos de [`H10B_SECURITY_AND_RECOVERY.md`](H10B_SECURITY_AND_RECOVERY.md). `Sites.Selected` por sí solo no garantiza los roles COVEX frente a llamadas directas a Graph ni una auditoría GMP inalterable.

## 2. SharePoint

Entregar estos valores no secretos:

```text
PORTABLE_ENTRA_TENANT_ID=
PORTABLE_ENTRA_CLIENT_ID=
PORTABLE_ENTRA_REDIRECT_URI=http://127.0.0.1:43110/acceso-denegado
PORTABLE_SHAREPOINT_SITE_ID=
PORTABLE_SHAREPOINT_DOCUMENT_DRIVE_ID=
PORTABLE_SHAREPOINT_LIST_PREFIX=COVEX
```

Ejecutar primero:

```powershell
$env:PORTABLE_SHAREPOINT_SITE_ID="..."
$env:PORTABLE_SHAREPOINT_LIST_PREFIX="COVEX"
pnpm portable:provision:dry-run
```

Revisar las 23 listas propuestas. Para aplicar el plan, usar un token administrativo efímero en `PORTABLE_PROVISION_ACCESS_TOKEN`; no guardarlo en archivo, historial, artefacto ni Actions. Para crear el primer perfil funcional, definir en esa misma sesión `PORTABLE_BOOTSTRAP_ADMIN_OBJECT_ID`, `PORTABLE_BOOTSTRAP_ADMIN_EMAIL` y `PORTABLE_BOOTSTRAP_ADMIN_DISPLAY_NAME`, y ejecutar `pnpm portable:provision`.

Después del aprovisionamiento, eliminar el token de la sesión. El usuario bootstrap debe administrar los perfiles siguientes desde la aplicación.

El aprovisionamiento normal deja las listas vacías. Solo para un sitio piloto sintético puede añadirse `--seed-synthetic`; no constituye aprobación de plantillas. El script rechaza columnas existentes cuyo tipo, índices o unicidad difieran del esquema y no las modifica automáticamente.

Al ejecutar Next.js directamente, usar `APP_ENV=production`, `AUTH_MODE=portable-entra`, `PERSISTENCE_PROVIDER=portable-sharepoint` y `DATABASE_URL` vacío. Electron fija los tres modos automáticamente.

## 3. Red y equipo Windows

Permitir HTTPS hacia `login.microsoftonline.com`, `graph.microsoft.com`, el dominio SharePoint corporativo y los hosts temporales `*.up.1drv.com` usados por las sesiones de carga. La aplicación solo escucha en `127.0.0.1:43110`.

Distribuir el artefacto firmado y escaneado mediante el canal corporativo. La CI genera el paquete, pero la firma de código, reputación SmartScreen, antivirus y sistema de actualización corresponden a IT.

## 4. Piloto de aceptación

Usar exclusivamente datos sintéticos y dos usuarios autorizados.

1. Verificar tenant, `oid`, MFA, caducidad/cierre de sesión y ausencia de token en disco/logs.
2. Confirmar que un usuario sin `UserProfile` activo no accede y que cada rol aplica las mismas reglas que H9A.
3. Crear, consultar y modificar personas, catálogos, formación, sesión, asistencia, formadores y control documental.
4. Generar Anexos III, IV y V; ejecutar importación de formaciones e importación de formadores; ejecutar revisión de integridad.
5. Cargar, recuperar y borrar un documento pequeño y otro mayor de 4 MB; comprobar hash/contenido y ausencia de sobrescritura.
6. Abrir el mismo registro con dos usuarios; confirmar aviso 412 al segundo guardado.
7. Crear formaciones y sesiones simultáneamente; comprobar que una obtiene el bloqueo, la otra recibe conflicto y, tras reintentar explícitamente, los códigos son únicos y las secuencias monotónicas.
8. Simular 429, 5xx, desconexión y corte entre pasos; verificar reintento, compensación o `NEEDS_RECONCILIATION` sin pérdida silenciosa.
9. Superar 5.000 elementos en una lista piloto o usar un conjunto equivalente controlado; comprobar índices y paginación.
10. Probar backup y restauración conjunta de listas y biblioteca, retención, versionado, papelera, DLP, residencia, eDiscovery y antivirus.

## 5. Puerta de producción

La edición no puede manejar datos personales reales ni documentación GMP hasta que IT y Calidad firmen las evidencias anteriores, aprueben el mínimo privilegio, el procedimiento de reconciliación y la recuperación. La conexión simulada de CI no satisface esta puerta.

El procedimiento de recuperación, el diagnóstico `GET /api/admin/portable-operations` y los límites pendientes están en [`H10B_SECURITY_AND_RECOVERY.md`](H10B_SECURITY_AND_RECOVERY.md).
