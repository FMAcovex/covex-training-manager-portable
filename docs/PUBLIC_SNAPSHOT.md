# Registro del snapshot público

## Procedencia

- Repositorio de origen: `FMAcovex/covex-training-manager` (solo lectura).
- Commit de origen: `b2414e3f7f702e0bd896a32e67b4e5fcd82789a4`.
- Fecha de preparación: 2026-10-16.
- Método: exportación del árbol del commit, sin copiar metadatos `.git`, ramas,
  etiquetas ni commits históricos.

## Revisión previa a la publicación

Se revisaron los 290 archivos versionados del snapshot antes de crear el
historial independiente. La revisión incluyó:

- nombres de archivo asociados a credenciales, certificados, bases de datos,
  copias de seguridad y configuración local;
- firmas de claves privadas, certificados, tokens de proveedores habituales y
  asignaciones de contraseñas o secretos;
- correos electrónicos, UUID, identificadores Entra/SharePoint y URLs;
- archivos binarios y recursos de marca;
- datos de demostración, seeds y fixtures de pruebas;
- documentación técnica y flujos de CI.

No se encontraron secretos, credenciales, identificadores corporativos reales
ni datos personales reales. Los valores similares a credenciales son
placeholders explícitos o fixtures aislados de CI; los correos de ejemplo usan
dominios reservados (`.example`, `.test` o `.invalid`). Los logos, estilos y
plantillas se conservan porque son necesarios para mantener el diseño y la
generación documental aprobados.

## Límites

Esta revisión cubre únicamente el árbol publicado en el commit indicado. Cada
cambio posterior debe mantener la prohibición de versionar secretos o datos
reales. Los valores corporativos de Microsoft Entra, Graph y SharePoint deben
inyectarse mediante configuración local no versionada o por los mecanismos de
secretos del entorno de ejecución.
