# Modelo de datos actual

Modelo lógico de datos consumidos por HTTP, no tablas ni persistencia propia del navegador. Los contratos reales están en src/types/contracts.ts. La preferencia devguardian.theme es independiente de los registros del servidor; no guarda tokens.

```mermaid
erDiagram
  Project ||--o{ Audit : contiene
  Audit ||--o{ Delegation : registra
  Project {
    string id
    string name
    string repoPath
  }
  Audit {
    string id
    string status
    string targetFile
  }
  Delegation {
    string taskId
    string role
  }
```
