# DevGuardian · Dashboard de operaciones

La selección de archivos reales, los checks de revisión y la consulta por líneas se explican en [Formularios de archivos](FORMULARIOS_ARCHIVOS.md). Los formularios generan el JSON internamente y solo lo muestran al activar las opciones avanzadas.

La navegación principal se divide en **Mis proyectos**, **Revisar código** y **Resultados e historial**. Las herramientas técnicas se agrupan bajo **Opciones avanzadas**. Ver [estructura del layout, rutas y garantías de seguridad](LAYOUT_Y_RUTAS.md).

## 🌐 Entorno de Producción Desplegado (Render)

- **URL Pública del Frontend (Dashboard):** https://proyecto-certificacion-ai-frontend.onrender.com
- **URL Pública del Backend (API & Healthcheck):** https://proyecto-certificacion-ai-backend.onrender.com/api/health
- **Base de Datos Cloud:** PostgreSQL **PCAI**, base lógica `pcai`, modo `postgres`, **5 tablas activas**.
- **Ramas activas:** `Dev` (Backend), `dev` (Frontend); versión de entrega consolidada también en `main` de ambos repositorios, conservando la autoría.
- **CI/CD:** GitHub Actions valida cada rama de entrega. Render espera **After CI Checks Pass** antes de redesplegar.
- **Runner en Render Free:** Node/Jest. **pytest se valida obligatoriamente en Ubuntu de GitHub Actions**, con Python 3.11, pytest-json-report y `DEVGUARDIAN_REQUIRE_PYTEST=1`; el health de la instancia web puede indicar pytest no disponible.
- **Calidad:** base anterior **285 pruebas Backend + 44 Frontend = 329**. Este cierre añade dos regresiones de backend y tres de frontend: **287 + 47 = 334 pruebas**, en **10 suites Backend + 3 archivos Vitest**.
- **Alcance:** Fases 1 a 6 implementadas. API, MCP HTTP, workers, Git, análisis, Jest y persistencia se ejecutan en el backend desplegado; el cliente generativo de Fase 6 es una CLI MCP, no un endpoint LLM del dashboard. No se acredita una llamada pagada real a Anthropic.

Los secretos se configuran en Environment de Render. Las copias locales `.env` están ignoradas por Git; nunca publicar DATABASE_URL ni claves en variables VITE_*.

### Flujo principal con un repositorio real

1. Pulsar **Registrar proyecto**, pegar el enlace público de GitHub y elegir **Importar y preparar**.
2. Revisar el progreso y la compatibilidad. Al terminar se selecciona el proyecto y un archivo real para **Ejecutar diagnóstico**.
3. Consultar los hallazgos y las delegaciones del diagnóstico en el historial. La importación habilita análisis estático; la reparación con pruebas requiere un entorno aislado.

El resultado DIAGNOSED conserva outcome=diagnosed y traza completed; la sesión DB mantiene status=blocked por el contrato histórico, pues diagnosticar no autoriza un commit. No es un error.

En **Hooks & Guardrails**, ejecutar **Probar ALLOW** y **Probar BLOCK · .env**. Son preflights reales: guardan evidencia y no modifican archivos. Recargar para comprobar persistencia. No se borran registros fallidos anteriores.

El dashboard ya no ofrece botones de carga de demos ni selecciona proyectos de ejemplo automáticamente. Los registros generados con el prefijo reservado `Demo Render ` o ubicados bajo `.devguardian-demo/` quedan ocultos del selector y del contador principal. Se conservan en la BD junto con su historial, sin eliminarlos. El endpoint técnico `/api/demo/prepare` del backend no se modifica ni se invoca desde el dashboard.


[![Frontend CI](https://github.com/SebhastianCampero-Collab/Frontend/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/SebhastianCampero-Collab/Frontend/actions/workflows/ci.yml)

Frontend React/TypeScript/Vite para operar el backend de DevGuardian. Trabaja con datos reales de REST y MCP: registra repositorios, ejecuta diagnóstico o reparación con un parche explícito, recupera auditorías desde la BD y muestra decisiones de guardrails y delegaciones a workers. No fabrica eventos, commits, herramientas ni resultados de pruebas.

## Requisitos e inicio local

Node.js **24.15 o superior dentro de la serie 24**, npm y el backend DevGuardian accesible. Git, Jest/pytest y la BD se ejecutan en el backend; no se instalan en el navegador.

```powershell
git switch dev
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Abrir `http://127.0.0.1:5173`. El valor predeterminado es `VITE_API_URL=http://127.0.0.1:3001`, **sin sufijo `/api`**. Reiniciar Vite después de cambiar `.env.local`; para producción, recompilar. `.env` y `.env.*` están ignorados; `.env.example` está permitido.

En la carpeta del backend, ejecutar previamente `npm.cmd run build` y `npm.cmd start` con las raíces autorizadas y BD configuradas. El origen del frontend debe estar permitido mediante `ALLOWED_ORIGIN`/`CORS_ORIGIN`. Si se activa `DEVGUARDIAN_API_TOKEN`, introducir su bearer en «Conexión y autenticación»: se conserva solo en memoria y se pierde al recargar. Solo la selección de proyecto se guarda en localStorage. No existe un login ficticio.

## Arquitectura

```text
src/
  api/client.ts                HTTP, Result, validación Zod, errores y JSON-RPC MCP
  types/contracts.ts           Contratos compatibles con el backend, sin imports Node.js
  hooks/
    useResource.ts             Lecturas cancelables, polling y exclusión de mutaciones duplicadas
    useServerHealth.ts         Estado del backend y BD
    useProjects.ts             Listado y alta de repositorios
    useAuditRunner.ts          Auditorías, resultados e historial durable
    useHookGuardrails.ts       Configuración, logs y evaluación real de políticas
    useSubagents.ts            Delegaciones y consumo de resultados
    useMcpTools.ts             initialize, tools/list y tools/call
  components/
    Header.tsx                 Conectividad, motor de BD y recarga manual
    ProjectsPanel.tsx           Alta de proyectos
    AuditPanel.tsx              Diagnóstico/reparación e historial
    CodeInspector.tsx          Hallazgos AST y contexto del worker
    TestRunnerView.tsx         Baseline/candidato y dictamen de comparación
    GitControlView.tsx         Rama, commit, rollback y estado persistido
    GuardrailsPanel.tsx        Configuración, simulador preflight y logs ALLOW/BLOCK/WARN
    AgentMonitorView.tsx       Línea de tiempo de workers, herramientas y consumo
    McpPanel.tsx               Catálogo y consola JSON de herramientas
    ui.tsx / ResultDrawer.tsx  Presentación de estados y evidencia JSON
  services/api.ts              Reexportación del cliente para compatibilidad de imports
  App.tsx / index.css         Navegación, proyecto activo y diseño responsive accesible
tests/                         Vitest + Testing Library: cliente, hooks y componentes
scripts/demo-backend.mjs       Servidor real de demostración con repo/BD temporales
.github/workflows/ci.yml        CI reproducible, sin despliegue ni secretos
```

Los estilos son CSS propio; se retiró la configuración incompleta de Tailwind/PostCSS. El tema consola usa Lucide, navegación por teclado, etiquetas de formularios, foco visible, estados vacíos y adaptación móvil. TypeScript mantiene `strict`, `exactOptionalPropertyTypes` y `noUncheckedIndexedAccess`. No hay `any` en el código.

## Custom hooks

| Hook                | Comportamiento                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useServerHealth`   | Consulta `/api/health` cada 15 s y bajo demanda. Distingue BD desconectada (503 con evidencia) de una respuesta saludable. El cliente admite también `/health`.                           |
| `useProjects`       | Recupera `/api/projects` cada 30 s, registra por POST y refresca la lista. La ruta absoluta pertenece al **equipo del backend**.                                                          |
| `useAuditRunner`    | Expone `run`, `select`, estado de ejecución e historial paginado. Recupera detalles por ID y consulta `/api/audits` cada 5 s. Las mutaciones no se reintentan automáticamente.            |
| `useHookGuardrails` | Lee configuración y logs, filtra por proyecto/auditoría y evalúa parches. Conserva `{ ok: false, data }` del HTTP 403 como una decisión `block` válida.                                   |
| `useSubagents`      | Consulta trazas cada 5 s y las ordena cronológicamente en cada página. Preserva `taskId`, `subagentId`, rol, tools, output, snapshots y consumo.                                          |
| `useMcpTools`       | Negocia el protocolo, lista las 19 herramientas actuales y ejecuta una llamada JSON-RPC con `projectId` inyectado. Conserva metadatos de auditoría y separa errores de protocolo/dominio. |

`useResource` cancela lecturas al desmontarse o cambiar de ámbito y descarta respuestas obsoletas. No solapa polling del mismo recurso y pausa el polling con la pestaña oculta. `useAction` impide dobles clics antes del siguiente render; un fallo no dispara otra mutación. Los paneles se desmontan al cambiar de proyecto para aislar sus resultados. La recarga manual vuelve a consultar BD y health; no utiliza un historial guardado en el navegador.

Las listas tienen páginas de 20 elementos (`limit`, `offset`); no se inventa un total cuando el servidor no lo proporciona. En logs, el selector ALLOW/BLOCK/WARN filtra la página actual.

## Subagentes: alcance del flujo REST

La UI y `useSubagents` soportan los roles `diagnostic`, `verification` y `patch-safety`, mostrando únicamente delegaciones devueltas por el backend, con sus herramientas, dictámenes y consumo de resultados.

**Limitación actual:** el coordinador REST delega diagnóstico y verificación, pero no registra delegaciones `patch-safety` en ese flujo. La protección del parche se ejecuta mediante hooks reales; por tanto, sus logs no se presentan como una delegación `patch-safety`. Para visualizar esa traza específica, el backend debe emitirla y persistirla. El frontend no inventa registros para suplir esta ausencia.

## Flujo de auditoría y reparación

1. Registrar/seleccionar un proyecto Git existente dentro de `DEVGUARDIAN_WORKSPACE_ROOT` del backend.
2. Elegir **Solo diagnóstico**, escribir una ruta relativa y ejecutar `POST /api/audits/run` con `{ projectId, mode: "diagnose", path }`.
3. Para reparar, usar **Reparación verificada** sobre un checkout limpio. Obtener el SHA-256 actual mediante `read_file_context`, indicar targets reales del runner del proyecto y proporcionar un unified diff, slug y mensaje.
4. El POST envía `{ projectId, mode: "repair", repair: { path, slug, message, unifiedDiff, expectedFileHashes, runner, targets } }`. El backend decide baseline, rama `fix/...`, checkpoint, hooks, candidato, comparación y commit/rollback.
5. Inspeccionar hallazgos AST, ambos runs, omisiones, integridad del reporte, hashes, dictamen, rama y SHA o rollback. La UI no autoriza un commit por su cuenta.
6. Recargar la página, seleccionar la sesión del historial y comprobar los mismos registros recuperados con GET `/api/audits` y GET `/api/audits/:id`.

La API REST actual **no invoca al LLM**: el cliente generativo de Fase 6 tiene su propio CLI sobre MCP. Esta UI permite el flujo REST con parche explícito y la consola de las herramientas publicadas; no inventa un endpoint generativo.

Un diagnóstico exitoso persiste actualmente como `audit.status: blocked` con `summaryJson.mode: diagnose` y `outcome: diagnosed`: se muestra **DIAGNOSED** y se explica que no se autorizó reparación. Un bloqueo real de hook puede coexistir con un rollback. Las evaluaciones preflight y herramientas MCP individuales tampoco se presentan como reparaciones completadas.

El POST es síncrono desde el cliente; durante su ejecución se muestra el estado running y el historial puede mostrar registros pendientes/en ejecución. Si hay timeout (180 s para mutaciones) o se cambia de panel, el backend puede seguir trabajando. Consultar el historial antes de repetir; cancelar una lectura o perder la página no demuestra cancelación del trabajo remoto.

## Demostración reproducible con backend, Jest y Git reales

Desde el backend, compilar primero. Desde este frontend, iniciar:

```powershell
node scripts/demo-backend.mjs --backend ../ProyectoCertiIA --port 3001
```

Este helper importa el backend compilado, crea un repositorio **temporal independiente**, dos pruebas Jest reales y una BD JSON fuera del workspace auditado. Solo autoriza su raíz temporal. No modifica el backend ni hace commits en los repositorios del equipo. Imprime la ruta del fixture, SHA-256, parche correcto y target. Escribe esos datos en `test-results/demo.json` (ignorado por Git).

Con Vite iniciado, registrar en la UI la ruta `workspace` impresa. Ejecutar diagnóstico en `src/bug.ts` y comprobar el error semántico. Reparar con el parche de `test-results/demo.json`, su SHA actual y `tests/bug.test.cjs`: se espera baseline fallido, candidato aprobado y commit. Para provocar rollback, sustituir `a + b` por `a * b` en el parche antes de ejecutar; usar el fixture todavía defectuoso. No reutilizar un hash anterior después de un commit.

En «Hooks & Guardrails», probar ALLOW y BLOCK `.env`: son evaluaciones reales sin aplicar el parche. En «Subagentes» filtrar por el UUID de auditoría y verificar diagnóstico, verificación y consumo. La UI también admite registros `patch-safety`, pero el coordinador REST actual no delega ese rol: la protección del parche se acredita mediante sus hooks reales; no se crea una delegación ficticia para aparentarlo. En «Catálogo MCP», ejecutar `tools/list`, revisar los 19 esquemas y probar `git_status` con `{}`.

Para comprobar persistencia **tras reiniciar el backend**, detener el helper con Ctrl+C o escribir `stop` en su terminal y ejecutar:

```powershell
node scripts/demo-backend.mjs --resume test-results/demo.json --port 3001
```

Recargar la UI: recuperará el mismo proyecto y auditorías desde el mismo JSON. Reiniciar la BD no reanuda sesiones Git activas del servidor. Para comenzar otra demostración desde un bug intacto, ejecutar el comando sin `--resume`: se crea otro fixture. Las carpetas temporales se conservan para inspección; no se borran automáticamente.

## Pruebas y CI

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

La entrega incluye **47 pruebas en 3 archivos**: contratos HTTP/JSON-RPC, 403 y 503, auth, validación, los seis custom hooks, respuestas obsoletas, prevención de mutaciones duplicadas, diagnóstico/reparación, recuperación del historial, guardrails, workers y catálogo MCP. Las pruebas unitarias simulan la frontera HTTP o el cliente; el helper anterior permite comprobar la integración con motores reales. Ninguna prueba de CI requiere backend remoto, BD cloud ni credenciales.

El workflow ejecuta `npm ci`, tipos + ESLint, Vitest y build en pushes/PR a `main`, `dev`, `Dev` y manualmente con `workflow_dispatch`. Usa Node 24, permisos de lectura, cancelación por rama y publica `dist` como artefacto. El estado remoto solo se acredita al subir los cambios y ejecutar Actions; una comprobación local no implica una ejecución remota aprobada.

## Despliegue del frontend

El bundle estático se genera en `dist/`. Configurar Node 24, `VITE_API_URL` con la URL **HTTPS pública del backend** y permitir el origen del frontend en CORS. `127.0.0.1` apunta al equipo de cada visitante y solo sirve para demostración local. La BD y los checkouts deben existir en el entorno del backend o en un worker autorizado; este frontend no implementa ese worker remoto.

| Proveedor | Configuración                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vercel    | Importar el repositorio, preset Vite, rama deseada, instalación `npm ci`, build `npm run build`, output `dist`. Configurar `VITE_API_URL` antes de compilar. |
| Render    | Crear **Static Site**, conectar rama, build `npm ci && npm run build`, publish directory `dist`, añadir `VITE_API_URL`.                                      |

Las vistas se seleccionan dentro de la página raíz, por lo que no requieren reglas SPA para rutas adicionales. El Static Site está desplegado en Render y su integración Git espera los checks de CI antes del redespliegue. No guardar secretos Anthropic, DATABASE_URL ni bearer en variables `VITE_*`: se incorporan al JavaScript público.

Referencias oficiales: [variables de Vite](https://vite.dev/guide/env-and-mode), [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [sitios estáticos en Render](https://render.com/docs/static-sites).
# Importación amigable desde GitHub

En **Nuevo proyecto**, pega un enlace público `https://github.com/usuario/repositorio` y pulsa **Importar y preparar**. La aplicación recibe progreso real por SSE y muestra los archivos/configuraciones faltantes si el repositorio no es compatible. Cuando termina, selecciona el proyecto y abre Auditoría con un archivo fuente real. El registro por ruta del servidor permanece en **Opciones avanzadas**.

Requiere un backend actualizado con `POST /api/projects/import`, accesible mediante el `VITE_API_URL` existente. Usa el mismo bearer en memoria que el resto de la API, sin incluirlo en la URL SSE. No se necesita otra librería, WebSocket ni variable de entorno.

La importación habilita análisis estático JavaScript/TypeScript; no instala paquetes ni ejecuta scripts. La reparación y las pruebas de proyectos importados quedan bloqueadas hasta contar con un entorno aislado. Los checkouts en disco efímero de Render pueden desaparecer al redesplegar; la BD no conserva por sí sola los archivos.

Verificación local: `npm run check`, `npm run build` y `npm test`. Las pruebas de importación están en `tests/import.test.tsx`.

El formulario recuerda la ruta elegida por proyecto y backend en el almacenamiento local del navegador. Si no existe una selección guardada, puede recuperar el archivo de un diagnóstico exitoso del historial; no presupone que el repositorio contenga `src/server/contracts.ts`. Sin una ruta conocida, solicita elegir un archivo.

El panel AST distingue diagnósticos completos, incompletos y resultados parciales. Solo muestra «0 hallazgos» cuando hay evidencia de un diagnóstico completado sin hallazgos. Un archivo inexistente muestra su ruta y pide corregirla. Estas regresiones se verifican en `tests/audit-state.test.tsx`.
