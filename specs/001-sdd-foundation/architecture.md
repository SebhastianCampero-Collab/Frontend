# Arquitectura actual

El navegador consume la API pública; no abre rutas del sistema ni conecta con PostgreSQL. Los hooks React gestionan estado de UI y no equivalen a los hooks de seguridad del backend.

```mermaid
flowchart TD
  U["Usuario"] --> APP["App y navegación"]
  APP --> UI["Componentes y formularios"]
  UI --> H["Hooks React"]
  H --> CLIENT["src/api/client.ts"]
  CLIENT --> REST["Backend REST y MCP HTTP"]
  REST --> PG["Persistencia del backend"]
  APP --> PREF["Preferencias locales de apariencia"]
```
