# Perfiles y permisos

Los permisos deben aplicarse en servidor. Ocultar botones en la interfaz no es una medida de autorización suficiente.

## USER — Usuario

Puede:

- acceder a la aplicación;
- crear formaciones;
- crear sesiones antes de ejecución;
- seleccionar asistentes;
- generar Anexo III de sesiones accesibles;
- consultar las formaciones/sesiones que el modelo final determine como accesibles.
- consultar la vista del Plan anual.

No puede:

- modificar sesiones ejecutadas;
- gestionar administradores;
- cambiar plantillas controladas;
- modificar configuración crítica.
- consultar el historial formativo individual completo;
- generar Anexo IV ni Anexo V.
- acceder a la pantalla específica de Documentación ni actualizar controles documentales.

## RESPONSIBLE — Responsable/Formador

Incluye permisos de USER y además puede:

- finalizar sesiones que tenga autorizadas;
- registrar asistencia y resultados;
- marcar controles documentales;
- consultar la cola y el control documental de Sesiones ejecutadas;
- consultar información adicional necesaria para seguimiento;
- realizar correcciones antes de ejecución dentro de su ámbito.
- consultar el historial formativo individual completo, incluido personal inactivo;
- generar Anexo IV y Anexo V.

No puede modificar sesiones ya ejecutadas salvo que además tenga rol ADMIN.

## ADMIN — Administrador

Puede:

- consultar todas las formaciones y sesiones;
- crear/modificar formaciones;
- modificar sesiones ejecutadas;
- gestionar personal interno/externo;
- activar/desactivar personas;
- gestionar roles internos de la aplicación;
- gestionar catálogos;
- gestionar versiones de plantillas;
- generar Anexos III, IV y V;
- consultar el Plan anual y el historial formativo individual completo;
- consultar historial de cambios;
- corregir datos con trazabilidad.
- consultar y actualizar controles documentales de Sesiones ejecutadas.
- previsualizar y confirmar la importación controlada de la plantilla 2026.
- consultar la revisión de integridad y navegar desde cada incidencia al expediente relacionado.

Los Administradores serán el usuario responsable del sistema y las personas que éste designe.

## Regla especial: sesión ejecutada

Si `executionStatus = EXECUTED`:

- USER: lectura, sin edición.
- RESPONSIBLE: lectura, sin edición.
- ADMIN: edición permitida con AuditEvent.

La actualización de los tres checks de `DocumentControl` es una operación documental independiente de la edición general de la Sesión: está permitida a `RESPONSIBLE` y `ADMIN` únicamente cuando la Sesión está `EXECUTED`. La autorización se aplica en servidor y todavía no usa ámbitos departamentales.

## Identidad

La identidad objetivo es Microsoft Entra ID. La aplicación no debe gestionar contraseñas propias en la arquitectura prevista.

El rol de aplicación se almacenará internamente vinculado al identificador de Entra, de forma que autenticación y autorización queden separadas.

## Administración

`canAccessAdministration(user)` permite acceso únicamente a `ADMIN`. `USER` y `RESPONSIBLE` reciben denegación en todas las rutas API administrativas y no ven el enlace de navegación.

El Administrador puede listar, crear, editar, activar y desactivar `UserProfile`; nunca gestiona contraseñas ni cambia `entraObjectId`, nunca borra perfiles y no puede desactivar o degradar al último `ADMIN` activo. También administra catálogos y metadata de versiones de plantilla bajo las reglas de preservación histórica.

La API de importación de formaciones exige `ADMIN` antes de leer el formulario o el archivo. `USER` y `RESPONSIBLE` reciben `403` tanto para previsualizar como para confirmar.

La vista de auditoría es de solo lectura. El actor de cada evento se obtiene siempre del usuario actual en servidor.

La revisión de datos también es exclusiva de `ADMIN` y de solo lectura. La autorización se aplica en el servicio además de la ruta de página; consultar el informe no genera cambios ni eventos de auditoría.
