# H10C — matriz de aceptación

Nota H10D: esta matriz conserva la aceptación de la base H10C. Su condición histórica de demo de solo lectura queda sustituida por [H10D](H10D_RESULT.md): cambios autorizados solo RAM y reinicio completo del EXE verificado, sin ampliar la aceptación corporativa.

Estados: **CI simulado** indica automatización con datos sintéticos; **CI Windows nativo** ejecuta el EXE empaquetado en el runner; **manual Windows pendiente** y **IT/Calidad pendiente** requieren evidencia corporativa. La ejecución concreta y sus artefactos se consultan en la PR H10C. Ninguna fila CI equivale a aceptación GMP.

| Caso | Automatización / evidencia | Estado de aceptación |
|---|---|---|
| Configuración pública estricta, importación/exportación, rechazo de secretos | Node tests y asistente del EXE | CI simulado + CI Windows nativo |
| Perfil con espacios/Unicode y configuración fuera de instalación | Tests temporales y ZIP extraído | CI Windows nativo; equipo físico pendiente |
| Carpeta de instalación de solo lectura | ACL sobre copia extraída; configuración en perfil | CI Windows nativo; políticas corporativas pendientes |
| Doble clic sin Node/PostgreSQL/Docker instalado para el usuario | Ejecución del EXE y Node embebido; no invoca herramientas externas | CI Windows nativo; usuario estándar físico pendiente |
| Puerto ocupado sin conectar/matar proceso ajeno | Servidor sintético ocupando 43110; mensaje y reintento | CI simulado + CI Windows nativo |
| Identidad del servidor y sesión local impredecible | HMAC, PID, host, cookie, Origin | CI simulado + CI Windows nativo |
| Instancia duplicada | Segundo EXE termina; primera permanece | CI Windows nativo |
| Arranque, UI, varios ciclos, cierre y puerto liberado | Playwright Electron sobre EXE; comprobación PID/puerto | CI Windows nativo |
| Demo siempre señalizada, sin acceso corporativo | Banner, proveedor, red local y variables aisladas | CI simulado + CI Windows nativo |
| Demo no carga archivos reales ni guarda formularios | Rechazo de importación, adjuntos y mutaciones en servidor; `.data` inaccesible | CI simulado + CI Windows nativo |
| Anexos III/IV/V y registro de formadores | Suite y descarga en demo; contenido sintético | CI simulado + CI Windows nativo |
| H10B: 22 modelos y flujos | Suite existente, importación histórica y smoke Graph firmado sintético | CI simulado; Microsoft 365 real pendiente |
| Dos usuarios, ETags, números y fallo parcial | Coordinador y transporte Graph simulados; bloqueo de reconciliación | CI simulado; dos Windows con IT pendientes |
| H9A/PostgreSQL/Docker | Jobs de migraciones, imagen y smoke anteriores conservados | CI simulado; implantación IT pendiente |
| ZIP, runtime completo sin symlinks externos, checksum e inventario | Packaging, SHA-256 y ejecución tras extracción | CI Windows nativo |
| Inicio de sesión Entra real, MFA y Conditional Access | Piloto de H10B + nueva configuración visual | IT/Calidad pendiente |
| Permisos efectivos fuera de la UI y auditoría inalterable | Prueba directa Graph y controles corporativos | IT/Calidad pendiente — NO-GO |
| Versionado, papelera, backup/restore de listas y biblioteca | Procedimiento H10B | IT/Calidad pendiente — NO-GO |
| Reconciliación y recuperación real tras caída | Bloqueo conservador; sin desbloqueo automático | IT/Calidad pendiente — NO-GO |
| Windows 11 x64 físico y Windows 10 x64 bajo política de soporte IT | Instalación/extracción, login, cierre y actualizaciones | Manual Windows pendiente |
| Usuario estándar, antivirus/SmartScreen, proxy y CA corporativa | Matriz por dos equipos/usuarios reales | Manual Windows pendiente |
| Firma de código y reputación | Requiere medios aprobados de IT | IT pendiente; candidata sin firma |
| Plantillas corporativas nuevas desde biblioteca | Límite H10B del cargador de fixtures controladas | IT/Calidad pendiente; no resuelto por H10C |

## Cierre de aceptación

Solo IT y Calidad pueden aprobar los datos reales y el uso GMP tras resolver los límites de confianza, permisos, auditoría y recuperación. H10C entrega distribución y evidencia técnica. No incorpora un botón para levantar ese NO-GO ni inicia otra fase.
