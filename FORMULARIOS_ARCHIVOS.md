# Consulta y revisión sin JSON manual

En **Revisar código**, el selector carga el árbol real del proyecto desde `GET /api/projects/{projectId}/files`. Solo permite elegir archivos disponibles; no inventa rutas cuando falta el checkout o falla la consulta. Hay un botón para actualizar el listado y un aviso si es parcial. En modo avanzado se conserva una ruta manual para tareas técnicas; continúa validándose en el cliente y en el servidor.

## Revisar código

Seleccionar un archivo JavaScript/TypeScript y al menos una comprobación:

| Etiqueta | Valor del contrato |
|---|---|
| Errores de sintaxis | `syntax` |
| Errores de tipos | `semantic` |
| Reglas de calidad | `lint` |

El formulario construye `{ projectId, mode: "diagnose", path, checks }` al pulsar **Revisar código**. La API REST valida y delega exactamente los checks solicitados al worker. No se cambia el flujo de reparación; este mantiene sus comprobaciones completas y sus restricciones existentes.

## Consultar archivo

El mismo componente de selección lista también documentos y configuraciones de texto permitidos. Elegir **Desde la línea** y **Hasta la línea**, y pulsar **Consultar archivo**. Se valida que sean enteros positivos y que el final no sea menor que el inicio. El frontend llama a la herramienta MCP `read_file_context` con `{ path, startLine, endLine }`, incorporando el projectId mediante el cliente existente.

La respuesta muestra el fragmento como texto escapado, el rango devuelto y cualquier aviso de contenido recortado. No ejecuta HTML ni scripts incluidos en el archivo. Cambiar el archivo o las líneas descarta el resultado anterior para no confundir contextos.

## Ver solicitud técnica

Cada formulario tiene un botón **Ver solicitud técnica** solamente cuando **Opciones avanzadas** está activo. Muestra un JSON generado y de solo lectura; no envía solicitudes ni permite saltarse validaciones. En modo sencillo no se pide escribir JSON.

## Estructura

- `src/components/FileSelector.tsx`: selección reutilizable, recarga, estados de error y listado parcial.
- `src/components/FileReader.tsx`: rango de líneas, invocación MCP y resultado.
- `src/components/TechnicalRequest.tsx`: vista técnica opcional del payload.
- `src/hooks/useProjectFiles.ts`: carga cancelable y aislada por proyecto.
- `src/components/AuditPanel.tsx`: selector y checkboxes de revisión.

El backend debe actualizarse junto con el frontend. La ruta de listado nueva y el campo opcional checks no existen en versiones anteriores del backend. No se han añadido dependencias ni variables de entorno.
