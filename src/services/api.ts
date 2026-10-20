const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; retryable?: boolean } };

async function request<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
      ...init,
    });

    const text = await response.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Respuesta no es JSON válido", retryable: false } };
    }

    if (typeof data === "object" && data !== null) {
      if ("ok" in data && !data.ok) {
        return {
          ok: false,
          error: {
            code: data.error?.code || "UNKNOWN_ERROR",
            message: data.error?.message || "Error desconocido en la respuesta del servidor",
            retryable: false,
          },
        };
      }
      return { ok: true, data: (data.data !== undefined ? data.data : data) as T };
    }

    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Formato de respuesta inesperado", retryable: false } };
  } catch (err: any) {
    return { ok: false, error: { code: "NETWORK_ERROR", message: err.message || "Error de conexión con el servidor", retryable: true } };
  }
}

export const api = {
  // Gestión de Proyectos y Persistencia
  getProjects: () => request<{ projects: any[] }>("/projects"),
  getAuditHistory: (projectId: string) => request(`/audit-history?projectId=${projectId}`),
  getHealthStatus: () => request<{ ok: boolean; healthy: boolean; details?: any }>("/health"),

  // Analizador Estático y AST
  readFileContext: (path: string, startLine?: number, endLine?: number) =>
    request<{ path: string; content: string; startLine: number; endLine: number; fileHash: string; truncated: boolean }>("/analyzer/read-file-context", {
      method: "POST",
      body: JSON.stringify({ path, startLine, endLine }),
    }),
  analyzeCode: (paths: string[], checks: ("syntax" | "semantic" | "lint")[]) =>
    request<{ analysisId: string; diagnostics: any[]; affectedSymbols: any[]; dependencies: any[]; analyzedFiles: string[]; truncated: boolean }>("/analyzer/analyze-code", {
      method: "POST",
      body: JSON.stringify({ paths, checks }),
    }),
  getSymbolContext: (path: string, line: number) =>
    request<{ symbol: any; signature: string; range: any; source: string; imports: any[]; references: any[]; fileHash: string; truncated: boolean }>("/analyzer/symbol-context", {
      method: "POST",
      body: JSON.stringify({ path, line }),
    }),

  // Ejecutor de Pruebas & Verificación
  runTests: (runner: "jest" | "pytest", targets?: string[], timeoutMs?: number) =>
    request<{ runId: string; runner: string; status: string; exitCode?: number; durationMs: number; summary: any; cases: any[]; stdout: string; stderr: string; truncated: boolean; complete: boolean; startedAt: string; finishedAt: string; workspaceStateHash: string; configurationHash: string }>("/runner/tests", {
      method: "POST",
      body: JSON.stringify({ runner, targets, timeoutMs }),
    }),
  compareTestRuns: (baselineRunId: string, candidateRunId: string) =>
    request<{ resolvedFailures: string[]; newFailures: string[]; missingTests: string[]; comparable: boolean; verdict: "success" | "regression" | "inconclusive" }>("/runner/compare", {
      method: "POST",
      body: JSON.stringify({ baselineRunId, candidateRunId }),
    }),

  // Controlador Git & Parches
  getGitStatus: () => request<{ branch: string | null; headCommit?: string; clean: boolean; staged: string[]; modified: string[]; untracked: string[]; conflicted: string[] }>("/git/status"),
  createFixBranch: (slug: string, expectedHead: string) =>
    request<{ sessionId: string; branch: string; baseBranch: string; baseCommit: string }>("/git/create-fix-branch", {
      method: "POST",
      body: JSON.stringify({ slug, expectedHead }),
    }),
  beginAttempt: (sessionId: string) =>
    request<{ attemptId: string; checkpointCommit: string }>("/git/begin-attempt", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    }),
  applyPatch: (sessionId: string, attemptId: string, unifiedDiff: string, expectedFileHashes: Record<string, string | null>) =>
    request<{ applied: boolean; changedFiles: string[]; diffHash: string }>("/git/apply-patch", {
      method: "POST",
      body: JSON.stringify({ sessionId, attemptId, unifiedDiff, expectedFileHashes }),
    }),
  commitFix: (sessionId: string, attemptId: string, message: string, expectedDiffHash: string, verificationRunId: string) =>
    request<{ commit: string; branch: string; files: string[] }>("/git/commit-fix", {
      method: "POST",
      body: JSON.stringify({ sessionId, attemptId, message, expectedDiffHash, verificationRunId }),
    }),
  rollbackAttempt: (sessionId: string, attemptId: string) =>
    request<{ restoredCommit: string; revertedFiles: string[]; branch: string; clean: boolean }>("/git/rollback-attempt", {
      method: "POST",
      body: JSON.stringify({ sessionId, attemptId }),
    }),

  // Auditoría, Hooks y Subagentes
  getHooksAuditLogs: () => request<{ logs: any[]; total: number }>("/audit/hooks"),
  getSubagentsStatus: () => request<{ agents: any[]; online: boolean }>("/agents/status"),
};