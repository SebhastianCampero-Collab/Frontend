# Layout y navegación de DevGuardian

## Estructura

```text
App
└── AdvancedOptions.Provider (estado de presentación, no permisos)
    ├── Sidebar
    │   ├── Navegación principal: tres secciones
    │   └── Opciones avanzadas: navegación técnica opcional
    └── Workspace
        ├── Header: estado del servidor y actualización
        ├── Selector de proyecto: compartido entre secciones
        ├── Contenido de la ruta
        │   ├── Mis proyectos: consulta, selección e importación GitHub
        │   ├── Revisar código: AuditPanel en vista review
        │   ├── Resultados e historial: AuditPanel en vista results
        │   └── Herramientas avanzadas: MCP, hooks o subagentes
        └── Conexión/autenticación: solo al mostrar opciones avanzadas
```

| Sección | URL hash | Contenido |
|---|---|---|
| Mis proyectos | `/#/projects` | Proyectos reales, importación y acceso a revisión/resultados |
| Revisar código | `/#/review` | Archivo, validación de ruta y diagnóstico; sin JSON ni historial en el formulario |
| Resultados e historial | `/#/results` | Última auditoría persistida, hallazgos y selección de operaciones anteriores |
| Hooks y guardrails | `/#/advanced/hooks` | Evaluaciones y evidencia técnica de controles |
| Trazas de subagentes | `/#/advanced/agents` | Delegaciones, consumo y metadatos |
| MCP y edición JSON | `/#/advanced/mcp` | Catálogo, esquemas y argumentos JSON directos |

`src/hooks/useNavigation.ts` define el mapa de rutas, escucha hashchange y permite enlaces directos, recarga y navegación atrás/adelante. La sección por defecto es Mis proyectos. No se necesita una dependencia de router ni nuevas reglas de rewrite en Render: la parte hash no se envía al servidor.

## Flujo sencillo

1. Seleccionar/importar un proyecto en Mis proyectos.
2. La importación abre Revisar código con un archivo sugerido. La selección se recuerda por proyecto.
3. Ejecutar diagnóstico usando el mismo contrato REST y la validación existente.
4. Al terminar, abrir automáticamente Resultados e historial. Si la operación devolvió un fallo, mostrarlo; navegar a resultados no convierte el fallo en éxito.
5. Al entrar directamente a Resultados e historial, recuperar la última auditoría desde la lista persistida. Un fallo de consulta no se presenta como ausencia confirmada de errores.

Cambiar entre revisión y resultados conserva la operación en memoria. Si se abandona el workspace durante una petición, el servidor puede continuarla; consultar después el historial antes de repetir. Una respuesta de un formulario ya desmontado no fuerza la navegación a otra sección.

## Opciones avanzadas

El botón Opciones avanzadas expande las herramientas técnicas y habilita detalles JSON, metadatos Git y formularios de reparación con sus hashes. Se muestran los detalles de la operación que ya estaba seleccionada; activar el modo no ejecuta una herramienta.

Una URL `/advanced/...` abre directamente su área técnica. Desactivar opciones avanzadas desde ella vuelve a Mis proyectos; desde una sección sencilla mantiene esa sección. El estado de presentación no se guarda como permiso ni se envía al servidor.

Los componentes usan `AdvancedOptions` para controlar visibilidad. App inicia en modo sencillo; fuera de App se conserva la presentación técnica de los componentes embebidos existentes. Esto no constituye una frontera de autorización.

## Seguridad

- Los mismos handlers, esquemas, tokens, límites, hooks y controles del backend se ejecutan en ambos modos.
- La validación de rutas también se ejecuta al diagnosticar en modo sencillo.
- Las reparaciones mantienen hashes esperados, verificación y contratos previos; ocultar detalles no permite omitirlos.
- Los repositorios importados continúan restringidos a análisis estático. Activar opciones avanzadas no habilita reparación ni ejecución de pruebas en esos checkouts.
- El bearer sigue en memoria y no se elimina ni se expone al cambiar de modo; la configuración de acceso se agrupa en el área avanzada.

## Archivos y verificación

- `src/App.tsx`: layout y selección de vistas.
- `src/hooks/useNavigation.ts`: rutas hash y suscripción al navegador.
- `src/components/AdvancedOptions.tsx`: contexto de presentación.
- `src/components/AuditPanel.tsx`: revisión/resultados con estado común.
- `src/hooks/useAuditRunner.ts`: ejecución y recuperación de auditorías.
- `src/components/ui.tsx` y `GitControlView.tsx`: detalles técnicos condicionales.
- `tests/navigation.test.tsx`: navegación, recuperación, separación visual y validación en modo sencillo.

Comandos: `npm run check`, `npm test`, `npm run build`.
