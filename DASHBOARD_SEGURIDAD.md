# Dashboard de Auditoría de Seguridad

La ruta `/#/advanced/hooks` conserva su lugar en Opciones avanzadas, pero ahora es exclusivamente de consulta. Se retiraron los tres ejemplos y el formulario Comprobar seguridad. La API de evaluación del backend y su cliente permanecen disponibles para sus otros consumidores; visitar el dashboard no los invoca.

## Políticas

`SecurityPolicies` representa la configuración real obtenida de GET /api/hooks/config: archivos protegidos, detección de secretos, ramas permitidas, límites del parche, evidencia de pruebas para commits y registro de decisiones.

El backend habilita sus reglas incorporadas por defecto; `rules[id] === false` las desactiva. `enabled === false` deshabilita los hooks. Se reflejan ambas condiciones, y no se presenta una política como activa si faltan sus patrones o restricciones correspondientes. Varias tarjetas representan aspectos de un mismo hook, no hooks adicionales.

La restricción de directorios y los timeouts existen en otros módulos, pero este endpoint no publica su configuración. La UI no inventa sus valores ni los enumera como protecciones verificadas. Una actualización fallida conserva la configuración anterior con un aviso de que puede estar desactualizada.

## Intercepciones

El registro usa GET /api/hooks/logs con projectId, decision=block, limit y offset. El backend filtra por decisión antes de paginar, para que los registros permitidos no oculten bloqueos anteriores. Las consultas antiguas sin decision conservan su comportamiento. El filtro es específico de este endpoint; no se acepta en otros listados.

La consola muestra fecha/hora, archivo, motivo, hook/evento y referencia de auditoría. Ordena primero los registros más recientes y elimina duplicados por ID. Son datos persistidos del backend, no eventos fabricados por el navegador. Una página sin bloqueos no acredita que el proyecto esté libre de riesgos.

Actualización automática mediante polling cada cinco segundos con la pestaña visible, más un botón de actualización con feedback. No se implementaron WebSockets ni SSE para este registro. No se reanuncia toda la consola a lectores de pantalla en cada recarga: el estado de actualización se informa por separado.

## Archivo involucrado

Se usa primero una ruta explícita de metadata.files o del motivo Protected file. Si no existe, se consulta la auditoría asociada con GET /api/audits/{id}, verificando que pertenezca al proyecto y al ID solicitados. La columna entonces dice Objetivo de la auditoría: no se asegura que ese objetivo identifique todos los archivos de un intento con varios destinos.

Si tampoco se puede recuperar ese dato, se muestra Archivo no informado por el backend y se conserva el bloqueo. No se deduce una ruta a partir del formulario, de un ejemplo ni del proyecto seleccionado.

Las consultas adicionales tienen concurrencia máxima de cuatro y timeout de cinco segundos por lectura. Sus respuestas se cachean por auditoría dentro del proyecto, con capacidad de 200 entradas; cambiar de proyecto reinicia el ámbito. No se cargan parches ni se hacen llamadas mutantes para completar una fila.

## Componentes y pruebas

- GuardrailsPanel: composición, filtro y consola.
- SecurityPolicies: tarjetas de configuración.
- useSecurityDashboard: polling y consulta acotada de objetivos de auditorías.
- securityDashboard: interpretación de reglas y rutas explícitas.
- tests/guardrail-form.test.tsx: reemplaza las pruebas del formulario retirado por pruebas de dashboard de consulta.
- Backend tests/server/security-dashboard.test.mjs: verifica autorización, filtrado previo a paginación y compatibilidad del endpoint.

Para probar localmente, reiniciar el backend actualizado, abrir Opciones avanzadas → Hooks y guardrails y revisar políticas y bloqueos existentes. Un diagnóstico permitido puede no producir bloqueos: actualizar este panel no ejecuta una acción para generarlos.
