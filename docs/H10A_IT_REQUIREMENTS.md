# H10A — requisitos exactos para IT

## Registro Microsoft Entra

IT debe crear una aplicación **single tenant** de tipo cliente público/SPA para Microsoft Authentication Library. No se usa ni debe entregarse un secreto de cliente.

- Redirect URI de la prueba Windows: `http://127.0.0.1:43110/portable-poc`.
- Flujo: Authorization Code con PKCE, sin implicit grant.
- Permisos delegados Microsoft Graph: `User.Read`, `Sites.ReadWrite.All` y `Files.ReadWrite.All`.
- Consentimiento de administrador cuando lo exija la política del tenant.
- Entregar como valores no secretos: tenant ID, client/application ID, SharePoint site ID, list ID y drive ID.

Para una fase productiva se recomienda sustituir los permisos amplios por el mínimo alcance corporativo aprobado (por ejemplo, acceso restringido al sitio mediante la política admitida por IT) y validar que la solución siga funcionando con ese alcance.

## Recursos SharePoint

Crear una lista dedicada a la prueba con estas columnas internas exactas:

| Nombre interno | Tipo |
|---|---|
| `Title` | Una línea de texto |
| `CovexCode` | Una línea de texto; valor único |
| `CovexYear` | Número entero |
| `PlanningType` | Elección: `PLANNED`, `UNPLANNED` |
| `Reason` | Varias líneas de texto |
| `IsGmp` | Sí/No |
| `OriginType` | Elección: `INTERNAL`, `EXTERNAL` |

Crear o seleccionar además una biblioteca documental. La aplicación guardará los archivos en `COVEX-Training-Manager/{trainingId}/`. En H10A el límite es 4 MB por archivo porque se usa la carga simple de Graph; cargas mayores requerirán upload sessions en H10B.

## Configuración local

Los seis identificadores son configuración pública, no credenciales:

```text
PORTABLE_ENTRA_TENANT_ID=
PORTABLE_ENTRA_CLIENT_ID=
PORTABLE_ENTRA_REDIRECT_URI=http://127.0.0.1:43110/portable-poc
PORTABLE_SHAREPOINT_SITE_ID=
PORTABLE_SHAREPOINT_TRAININGS_LIST_ID=
PORTABLE_SHAREPOINT_DOCUMENT_DRIVE_ID=
```

No introducir tokens, certificados, contraseñas ni secretos en `.env`, GitHub Actions o el repositorio. MSAL obtiene el token mediante el inicio de sesión del usuario.

Durante desarrollo, Next.js lee estos valores de `.env.local`. El paquete compilado los lee en tiempo de ejecución y no necesita recompilarse: IT puede definirlos como variables de entorno del usuario/equipo antes de abrir el `.exe` (por ejemplo, mediante la política corporativa o `$env:PORTABLE_ENTRA_TENANT_ID="..."` en la misma sesión de PowerShell). Los valores corporativos no se incorporan al artefacto.

## Red y controles corporativos

Permitir HTTPS hacia `login.microsoftonline.com`, `graph.microsoft.com` y los dominios SharePoint del tenant. Confirmar políticas de Conditional Access, MFA, dispositivos administrados, caducidad de sesión y permisos efectivos del usuario. La aplicación escucha solo en `127.0.0.1:43110`.

Los permisos delegados de Graph representan al usuario, pero no implementan por sí solos los roles funcionales de COVEX. Hasta que H10B resuelva la autorización interna y la auditoría completa, la lista y la biblioteca deben estar restringidas a un grupo piloto controlado, sin datos personales reales ni documentación GMP.

## Evidencia de aceptación solicitada a IT

1. Inicio de sesión en un equipo Windows corporativo y confirmación de tenant/usuario correctos.
2. Alta, lectura y modificación de una Formación de prueba.
3. Conflicto controlado: dos clientes leen el mismo elemento; el segundo guardado recibe aviso y no sobrescribe silenciosamente.
4. Carga, descarga y comprobación del contenido de un documento ficticio.
5. Simulación o evidencia de throttling/error de red y recuperación posterior.
6. Confirmación de logs, retención, DLP, antivirus, backup, residencia y permisos del sitio.
7. Aprobación formal del alcance de permisos antes de H10B.
