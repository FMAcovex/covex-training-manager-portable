# H10C — entrega a IT

## Alcance e inventario

Candidata `0.3.0-rc.1`, Windows x64, basada en H10B `6fa4aee00356453fb3e0b0435a48e9bbaa4e3b25`. Mantiene Next.js, los 22 modelos/adaptadores, reglas, módulos, anexos e importaciones. H9A conserva PostgreSQL y Docker como alternativa independiente.

El artefacto CI `covex-training-manager-portable-windows-h10c` contiene ZIP portable, SHA-256 y manifiesto del commit. El ZIP incluye EXE Electron, sus DLL/recursos, `resources/app/runtime` con Next standalone, asistente, `README_INICIO_WINDOWS.md` e inventario `BUILD_MANIFEST.json`. Debe extraerse completo; no es un EXE autónomo de un solo archivo ni un instalador.

La configuración se guarda en el perfil de usuario, fuera de la instalación. El empaquetado copia dependencias reales, sin enlaces a la carpeta de desarrollo, y excluye `.env*`, `.data`, tests operativos, simuladores Graph, claves/certificados y dumps. Los recursos sanitizados necesarios para generar anexos y la semilla de navegación demo siguen formando parte de la aplicación; no son datos reales ni aprobación de nuevas plantillas.

## Puerta de aceptación

**NO-GO para datos corporativos y uso GMP.** H10C facilita la distribución; no resuelve por sí solo los límites documentados en `H10B_SECURITY_AND_RECOVERY.md`: permisos Graph delegados fuera del backend, autenticidad/inmutabilidad de auditoría, ausencia de transacciones multi-lista, reconciliación y carga de nuevas plantillas corporativas.

La comprobación de red del asistente no valida una conexión COVEX. No hay interruptor de aprobación GMP, desbloqueo automático ni ampliación de permisos. Los tests y capturas usan únicamente datos sintéticos.

## Microsoft Entra y SharePoint

- Aplicación SPA/cliente público, tenant único, Authorization Code + PKCE; sin secreto de cliente ni implicit grant.
- URI exacta: `http://127.0.0.1:43110/acceso-denegado`.
- Permisos delegados solicitados: `User.Read` y `Sites.Selected`, con consentimiento y concesión al sitio aprobados por IT. No ampliar automáticamente a `Sites.ReadWrite.All`.
- Verificar MFA, Conditional Access, dispositivo administrado, cierre/caducidad de sesión y compatibilidad del OAuth embebido. Tenants federados o flujos que requieran otros dominios pueden ser bloqueados por la lista de navegación y necesitan revisión, no relajarla sin evaluación.
- Aprovisionar las 23 listas H10B y biblioteca; ejecutar primero `pnpm portable:provision:dry-run` en el entorno de administración. El usuario final no necesita herramientas Node ni permisos de aprovisionamiento.
- Crear el primer ADMIN con el bootstrap de IT. El asistente no modifica perfiles, listas ni permisos.

El JSON público tiene solo estas claves:

```json
{
  "schemaVersion": 1,
  "tenantId": "11111111-1111-4111-8111-111111111111",
  "clientId": "22222222-2222-4222-8222-222222222222",
  "siteId": "synthetic.sharepoint.com,33333333-3333-4333-8333-333333333333,44444444-4444-4444-8444-444444444444",
  "listPrefix": "COVEX",
  "driveId": "b!synthetic-drive-000000000",
  "redirectUri": "http://127.0.0.1:43110/acceso-denegado"
}
```

Los ejemplos son ficticios y no prueban conectividad. No introducir secretos, tokens, claves de desbloqueo o rutas de ejecutables en este JSON. Se rechazan propiedades desconocidas, formato incorrecto, archivos mayores de 16 KB y enlaces simbólicos. La escritura es atómica; exportación/importación usa diálogos nativos y solo configuración pública. El diagnóstico no incorpora estos identificadores.

## Aislamiento y arranque

El asistente es una ventana local `file:` con CSP estricta y un preload de IPC limitado a operaciones concretas. Solo su frame principal puede invocar esos canales. La ventana Next.js no tiene ese bridge: sandbox, context isolation, Node deshabilitado, webviews y permisos denegados. Las ventanas OAuth se restringen a destinos HTTPS permitidos.

Navegación OAuth: `login.microsoftonline.com`, `login.microsoft.com`, `sts.windows.net` (HTTPS/443). Recursos estáticos Entra: `aadcdn.msftauth.net` y `aadcdn.msauth.net`, sin concederles navegación privilegiada. Otros dominios/federación requieren revisión de IT. No se usa wildcard global ni se desactiva seguridad web.

La aplicación escucha exclusivamente en `127.0.0.1:43110`. Si está ocupado, el lanzador falla antes de conectarse; no mata el proceso ajeno ni cambia la URI Entra. Tras arrancar el hijo, verifica desafío HMAC, identidad aleatoria y PID antes de cargar la UI. La clave nunca se envía a un servicio desconocido durante esta comprobación.

Cada ejecución recibe una cookie local aleatoria HttpOnly/SameSite Strict y una sesión Electron temporal. El middleware comprueba host, cookie y Origin. MSAL y los tokens H10B permanecen en memoria. Volver al asistente termina el servidor y limpia la sesión; cambiar de modo exige cerrar el proceso anterior. El sistema operativo y los procesos que controlen al propio usuario siguen fuera de esta frontera de confianza.

El hijo recibe solo variables de sistema/red necesarias y modos explícitos; no hereda `NODE_OPTIONS`, credenciales de desarrollo ni configuración corporativa en demo. Los certificados/proxy gestionados se conservan como selectores sin registrar su contenido. No se omite verificación TLS. El acceso de escritura requerido es al perfil del usuario; la instalación no guarda datos ni caché de imágenes optimizadas.

## Demo

Señalización permanente `DEMO — DATOS FICTICIOS`. Proveedor demo explícito, sin base de datos, sin leer ni escribir `.data`, sin acceso Microsoft 365 y sin promover datos. La UI permite navegar, examinar formularios y generar anexos sobre la semilla sintética. El servidor deniega cambios, importaciones, adjuntos y rutas Graph. La red de la ventana demo solo permite el origen local. Es una demostración de navegación, no una prueba de escritura productiva.

## Distribución, red y soporte

Revisar el SHA-256 del ZIP y el commit de `BUILD_MANIFEST.json`. Distribuir por el canal corporativo. El paquete es candidato sin firma: medios de firma de código, SmartScreen, allowlisting y análisis antivirus deben aportarlos IT de forma segura. No se ha firmado ni validado antivirus físico. No se incorporan actualizaciones remotas silenciosas, telemetría de Next ni envío de diagnósticos.

Permitir HTTPS a `login.microsoftonline.com`, `graph.microsoft.com`, el SharePoint del tenant y los hosts de upload session necesarios (`*.up.1drv.com`/SharePoint). El modo demo no requiere red corporativa. Proxy/autenticación integrada, inspección TLS y CA corporativa necesitan validación real en cada equipo.

## Pruebas y aceptación real

La CI ejecuta Node unit tests del lanzador, regresión completa, Graph/Entra simulados, empaquetado Windows y un smoke del EXE extraído en una ruta con espacios/Unicode. Verifica asistente/configuración, demo y anexos, rechazo anónimo y de importaciones/adjuntos, instancia duplicada, puerto ocupado, identidad del servidor, varios arranques, cierre y liberación de puerto. El EXE se abre desde una copia de solo lectura para comprobar separación del perfil.

La cuenta/desktop del runner Windows no demuestra usuario estándar ni Windows 10/11 físicos. Consultar `H10C_ACCEPTANCE_MATRIX.md`; ejecutar con dos usuarios y dos Windows los casos de MFA, permisos directos Graph, red caída, ETag, numeración, versionado/papelera, copia/restauración conjunta y reconciliación. Conservar NO-GO hasta la firma de IT y Calidad.

## Actualización y rollback

Cerrar COVEX y su servicio, extraer la nueva versión en otra carpeta y conservar la configuración pública del perfil. No mezclar runtimes ni borrar el bloqueo de H10B. Para rollback usar el ZIP anterior y comprobar compatibilidad del esquema de configuración; exportar el JSON público previamente. Las listas y biblioteca necesitan backup/restauración conjunta independiente del ZIP. Un cambio de tenant requiere cerrar sesión/proceso y configurar de nuevo; nunca sincroniza ni migra datos demo.
