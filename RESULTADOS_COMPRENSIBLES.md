# Resultados en lenguaje claro

`ResultResponse` aparece antes del panel AST y de la evidencia técnica. Construye un resumen determinista a partir de la auditoría persistida: no hace llamadas a un LLM, no ejecuta reparaciones ni completa con información inventada los datos ausentes.

| Estado técnico | Presentación |
|---|---|
| diagnosed | Análisis terminado |
| committed | Corrección verificada y guardada |
| rolled_back | Cambio revertido porque no superó la verificación |
| blocked | Operación bloqueada, seguida del motivo registrado |
| failed | Operación no completada |
| recovery_required | Se necesita revisión manual |

Los valores originales se mantienen en los contratos, peticiones y registros. Una auditoría histórica con status blocked y outcome diagnosed se presenta como análisis terminado: no es un bloqueo de seguridad. Una reversión sigue siendo una reversión aunque también haya hooks bloqueados.

Para declarar una corrección verificada, el resumen contrasta el commit, la rama fix/, los runs referenciados, los reportes completos, la ausencia de pruebas omitidas, la configuración y los IDs del dictamen ready_to_commit. Si falta evidencia, muestra Verificación incompleta y explica que hay un commit registrado sin suficiente detalle para confirmar su verificación. No afirma que se hizo push.

Los diagnósticos muestran las comprobaciones que quedaron registradas. Si no se ejecutó semantic, se indica que no se revisaron errores de tipos. Un análisis estático sin hallazgos no certifica la ausencia de errores de lógica. Los registros antiguos sin checks no se presentan como una revisión completa de todo.

## Accesos a la evidencia

Debajo del resumen hay tres botones:

- **Consultar pruebas:** abre las ejecuciones persistidas de antes/después. Si no hay pruebas, explica la diferencia entre diagnosticar y ejecutar tests.
- **Ver cambios realizados:** muestra el archivo objetivo, el resultado del intento y los metadatos del commit disponibles. La auditoría actual no almacena un unified diff completo; no se reconstruye el pasado desde un checkout que puede haber cambiado ni se inventan líneas modificadas.
- **Detalles técnicos:** disponible solo al activar Opciones avanzadas. Abre el control Git y permite desplegar el JSON original, hashes y metadatos. El modo sencillo muestra una indicación para activar esas opciones.

Los botones solo consultan el objeto persistido cargado: no llaman a git_diff, no ejecutan pruebas ni mutan el repositorio. Cambiar de auditoría reinicia el panel de evidencia abierto.

## Archivos

- `src/utils/resultPresentation.ts`: etiquetas y resumen basado en evidencia.
- `src/components/ResultResponse.tsx`: resumen y botones.
- `src/components/ui.tsx`: etiquetas legibles, conservando el valor técnico en data-status.
- `src/components/AuditPanel.tsx`: coloca la respuesta antes de los hallazgos y del historial.
- `tests/result-response.test.tsx`: verificación completa/incompleta, bloqueo, rollback, selección de checks y consulta sin mutaciones.
