# Procesos actuales

El usuario prepara argumentos mediante formularios; la evidencia proviene del backend. Una selección no dispara herramientas de mutación. Importar un repositorio prepara análisis estático y no implica ejecutar sus dependencias.

```mermaid
sequenceDiagram
  actor U as Usuario
  participant UI as React
  participant API as Backend
  U->>UI: Pegar URL pública e importar
  UI->>API: Solicitar importación
  API-->>UI: Progreso SSE y validación
  UI-->>U: Proyecto listo o faltantes
  U->>UI: Elegir archivo y revisar
  UI->>API: Enviar diagnóstico
  API-->>UI: Hallazgos reales y auditoría
  UI-->>U: Resumen e historial
```
