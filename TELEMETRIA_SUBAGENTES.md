# Visor de telemetría de subagentes

La ruta `/#/advanced/agents` presenta un terminal visual de consulta. No es una shell: no interpreta comandos, HTML ni secuencias ANSI. Todas las celdas se renderizan como texto de React.

## Fuente y flujo

Se mantiene el endpoint de delegaciones y su polling cada cinco segundos con la pestaña visible. Cada página contiene hasta veinte delegaciones. `traceTelemetry` convierte las marcas y registros persistidos en líneas correlacionadas:

- Coordinador → subagente: invocación.
- Subagente → herramienta: solicitud registrada.
- Herramienta → subagente: resultado registrado.
- Subagente → coordinador: respuesta del worker.
- Coordinador: consumo del resultado, conservando todas sus transiciones registradas.

Las filas muestran Diagnóstico, Verificación o Seguridad según el rol real, nombre de herramienta, estado, duración y los identificadores de worker/tarea/auditoría. Seguridad corresponde al rol técnico patch-safety. No todas las operaciones invocan los tres roles: seleccionar un filtro no crea ni ejecuta un subagente.

Las horas proceden de snapshots o de startedAt/finishedAt del backend. Las duraciones se toman de durationMs; no se calculan a partir de temporizadores de la interfaz ni se sustituye una duración de herramienta por la duración total del worker. Sin datos se informa Hora no informada o Sin medición informada. Los eventos sin hora se sitúan al final.

Una llamada con dispatched=false se presenta como no ejecutada. El historial se deduplica por tarea y evento para no repetir filas en cada actualización. Las filas se ordenan por las marcas de tiempo disponibles; varias marcas iguales no prueban un orden temporal de mayor precisión.

El terminal usa fondo oscuro, monoespaciado, colores por rol y scroll en ambas direcciones. Sigue el final si el usuario permanece abajo; al desplazarse hacia arriba conserva la posición para inspección.

## Filtros

Botones Todos, Diagnóstico, Verificación y Seguridad, además del filtro existente por UUID de auditoría. El rol se filtra localmente en la página cargada; no implica una búsqueda de todas las páginas del servidor. La paginación mantiene su alcance de delegaciones, no de líneas renderizadas.

## Exportar traza

El botón descarga JSON con los eventos visibles, el proyecto, filtros, offset, límite de delegaciones y fecha de exportación. La fecha de exportación es del navegador y está separada de los timestamps de los eventos. El archivo declara expresamente su alcance current-page.

La descarga contiene solo telemetría normalizada: IDs, roles, herramientas, tipos de evento, estados, tiempos y el indicador de ejecución. No incluye prompts, objetivos completos, contexto, código fuente ni entradas/salidas completas de herramientas. El archivo no se presenta como un volcado íntegro de la base de datos.

No hay descarga automática ni petición mutante al exportar. El object URL se revoca tras iniciar la descarga. Si falla la actualización, los últimos datos pueden exportarse con stale=true; se advierte en pantalla. Sin datos o durante la carga, el botón queda deshabilitado.

## Archivos y pruebas

- `src/components/AgentMonitorView.tsx`: filtros y descarga.
- `src/components/TraceTerminal.tsx`: terminal y seguimiento de scroll.
- `src/utils/traceTelemetry.ts`: normalización y formato de exportación.
- `tests/trace-terminal.test.tsx`: tiempos reales/ausentes, consumos múltiples, roles, llamadas denegadas, privacidad y descarga explícita.

Validación: `npm run check`, `npm test`, `npm run build`.
