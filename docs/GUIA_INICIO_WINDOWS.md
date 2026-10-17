# COVEX Training Manager Portable — inicio en Windows

Versión candidata H10D `0.4.0-rc.1`, Windows x64. **NO-GO para datos corporativos y uso GMP. Utilizar únicamente datos ficticios.**

## Descargar y abrir

1. En la PR H10D, abre la ejecución de CI y descarga el artefacto `covex-training-manager-portable-windows-h10d` (requiere iniciar sesión en GitHub).
2. Extrae el artefacto descargado. Dentro están `COVEX-Training-Manager-Portable-0.4.0-rc.1-windows-x64.zip`, su archivo `.sha256` y el manifiesto de compilación.
3. Extrae también ese ZIP de distribución en una carpeta propia. No ejecutes el programa dentro de la vista del ZIP.
4. Abre la carpeta `COVEX Training Manager Portable-win32-x64` y haz doble clic en `COVEX Training Manager Portable.exe`.
5. Conserva juntas todas las carpetas y archivos. **No es un EXE único:** incluye Electron/Node embebido, Next.js y recursos. No necesitas instalar Node.js, pnpm, PostgreSQL ni Docker, ni usar una consola para configurar la aplicación.

Windows 11 x64 es el objetivo recomendado. La aceptación en Windows 10/11 físicos, antivirus y usuario estándar está pendiente de IT; un runner Windows Server de CI no sustituye esa comprobación. No se distribuye una variante de 32 bits ni ARM64.

## Probar ahora sin IT

Pulsa **Abrir demostración**. Verás la interfaz corporativa existente, datos ficticios, formaciones, sesiones, asistentes, personal, formadores, catálogos, planes, controles documentales, historial y anexos.

La etiqueta **DEMO — DATOS FICTICIOS** permanece visible. La demo H10D permite guardar formaciones, sesiones y sus asistentes/resultados **solo en memoria**, usando los mismos formularios y validaciones que la aplicación existente. No introduzcas información real. Al cerrar la ventana de trabajo o toda la aplicación se descartan los cambios; volver a abrir restaura exactamente la semilla ficticia. Recargar una página no los borra mientras el servicio siga abierto.

### Prueba completa en cinco minutos

1. Opcional: en **Personal**, añade «Asistente ficticio de prueba», con puesto ficticio y departamento Calidad. También puedes usar las personas Demo existentes.
2. En **Formaciones → Nueva formación**, indica un nombre ficticio y completa los campos obligatorios. Para una formación interna selecciona un formador cualificado Demo, modalidad, duración, referencia ficticia, contenido, colectivo, método de evaluación y criterio de aptitud. Si eliges «No planificada», escribe también su motivo.
3. Guarda la formación. En su ficha, **Editar** permite corregir sus datos; el año y código se conservan conforme a las reglas existentes.
4. Pulsa **Añadir sesión**. Indica fecha, formador, duración y selecciona asistentes ficticios. Guarda; **Editar** permite cambiar datos y añadir/quitar asistentes mientras esté Pendiente. No se admiten duplicados.
5. Pulsa **Preparar cierre**. Indica la fecha de ejecución y, para cada asistente, Asiste/No asiste y Apto/No apto. **Guardar y finalizar → Finalizar sesión** confirma el resultado. La documentación pendiente no impide ejecutar.
6. Para corregir resultados ya finalizados, escribe un **Motivo de reapertura**, confirma **Reabrir sesión** y vuelve a finalizar con los resultados corregidos. La auditoría ficticia conserva la operación anterior solo durante esta ejecución.
7. Pulsa **Generar Anexo III**. Se descarga un PDF de esa sesión con los datos ficticios introducidos, utilizando el generador existente. Puedes abrirlo con tu lector PDF; no es un registro oficial ni una aprobación GMP.
8. Cierra toda la aplicación y vuelve a abrir el EXE y la demostración. Busca los nombres creados: ya no deben estar. Las personas, formaciones y sesiones Demo originales vuelven a su estado inicial.

Los PDF que descargues voluntariamente permanecen en tu carpeta de descargas: no son una base de datos ni se reimportan al reiniciar. No se exportan ni promueven registros de demo al entorno corporativo. Anexos IV/V y consulta de otros módulos siguen disponibles con datos ficticios.

Importaciones, selección de archivos reales, adjuntos, cambios de controles documentales, cierre documental, administración y Microsoft 365 permanecen bloqueados en servidor. Algunos botones corporativos se conservan por reutilización de la interfaz: muestran el rechazo explícito de demo; no guardan esos cambios. La demo no utiliza SharePoint, Entra ni PostgreSQL y no lee ni escribe `.data`, OneDrive o archivos funcionales previos. El asistente H10C conserva por separado sus identificadores públicos en el perfil, nunca los registros de demo.

## Preparar el piloto Microsoft 365

IT debe proporcionarte seis valores públicos: Tenant ID, Client ID, Site ID, prefijo de listas, Drive ID y la URI registrada de redirección.

1. En el asistente, rellena los campos o pulsa **Importar JSON público** para cargar el archivo entregado por IT.
2. La URI debe ser exactamente `http://127.0.0.1:43110/acceso-denegado`. No se cambia el puerto para sortear un conflicto.
3. Pulsa **Guardar configuración pública**. No introduzcas tokens, contraseñas, certificados ni secretos de cliente; el asistente no los admite.
4. **Comprobar conectividad** solo comprueba respuesta pública de Entra y Graph. No valida usuario, permisos ni almacenamiento SharePoint.
5. Confirma que usarás únicamente datos sintéticos y pulsa **Abrir piloto Microsoft 365**. Identifícate mediante Microsoft Entra cuando lo solicite la aplicación. IT debe haber creado tu perfil COVEX activo.

Los identificadores se guardan por usuario en `%APPDATA%\COVEX Training Manager Portable\microsoft365.public.json`. No necesitas editar este archivo ni crear `.env`. Cada equipo y usuario tiene su configuración independiente. Para cambiar de tenant, cierra la aplicación de trabajo y vuelve al asistente antes de importar los nuevos valores.

**Esta candidata no autoriza datos reales.** IT y Calidad deben validar Entra, SharePoint, permisos efectivos, auditoría y recuperación conforme a las guías de entrega.

## Cerrar y cambiar de modo

- Cerrar la ventana de trabajo detiene su servicio Next.js y vuelve al asistente.
- El menú **COVEX → Configuración / cambiar de modo** cierra el servicio y la sesión antes de mostrar el asistente.
- Cerrar el asistente o elegir **Salir de COVEX** termina la aplicación y su proceso local. No deja un servidor privado instalado.
- Un segundo doble clic enfoca la instancia existente; no inicia otra copia.

## Errores frecuentes y diagnóstico

| Mensaje | Acción |
|---|---|
| `PORT_IN_USE` | Cierra otra instancia de COVEX. Si persiste, consulta a IT; COVEX no se conecta al proceso ajeno ni lo mata. |
| `CONFIG_INVALID` / `CONFIG_MISSING` | Revisa los identificadores con IT o importa de nuevo el JSON público. |
| `NETWORK_CHECK` | IT debe revisar Internet, proxy y certificados. La demo no necesita esta conexión. |
| `SERVER_START` / `SERVER_TIMEOUT` | Confirma extracción completa del ZIP, acceso al perfil de usuario y antivirus; usa Reintentar o exporta diagnóstico. |
| Usuario sin acceso | IT debe verificar el tenant, consentimiento y perfil COVEX activo. |
| Operación requiere reconciliación | Detén las escrituras y entrega el identificador a IT. Reiniciar no desbloquea la operación. |
| SmartScreen o antivirus bloquea | Detén la ejecución y solicita aprobación a IT. No desactives la protección ni cambies políticas corporativas. |

El asistente permite **Copiar diagnóstico redactado** o **Exportar diagnóstico redactado**. Incluye versión, modo y códigos de estado; excluye tokens, identificadores de Microsoft 365, datos funcionales, rutas personales y stacktraces. No se envía automáticamente a terceros.

## Actualizar o volver a la versión anterior

Sal de COVEX, descarga el nuevo ZIP y extráelo en otra carpeta. Abre su EXE: la configuración pública por usuario se conserva. No mezcles carpetas de runtime entre versiones y conserva el ZIP anterior para rollback. Los datos del piloto permanecen en SharePoint; una actualización del EXE no es una copia de seguridad de listas y biblioteca.

IT puede comprobar el ZIP con `Get-FileHash -Algorithm SHA256` y comparar con el archivo `.sha256`. El ZIP no está firmado: firma de código, reputación SmartScreen y aprobación corporativa siguen pendientes.
