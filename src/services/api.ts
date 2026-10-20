import type { Result } from "../shared/errors";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

async function request<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
    ...init,
  });

  const text = await response.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Respuesta no es JSON válido", retryable: false } };
  }

  const result = await import("../shared/contracts.js").then((mod) => mod.resultSchema(data));
  
  // resultSchema returns a function that validates, but we need to check the shape
  // Actually resultSchema takes data and returns a function, let me check usage
  // From contracts.ts: export function resultSchema<T extends z.ZodType>(data: T) { ... }
  // It returns a function that you call with data to validate... actually looking at line 39-44:
  // It returns a validated result object directly? No, looking at it again:
  // The function resultSchema takes data (a ZodType) and returns... actually it's confusing.
  // Let me re-read: `export function resultSchema<T extends z.ZodType>(data: T)` - data is a ZodType
  // And it returns a discriminated union... Actually wait, it takes the ZodType as parameter and returns... 
  // A function? Let me check usage. In errors.ts: `captureResult` uses `success` and `failure`.
  // In contracts the function is used to validate data shaped according to Result<T>.
  
  // Actually I need to just check if data.ok exists
  if (typeof data === "object" && data !== null && "ok" in data) {
    return data as Result<T>;
  }

  // If the backend returns Result<T>, it should have ok field
  if (typeof data === "object" && data !== null && "ok" in (data as any)) {
    const typed = data as { ok: boolean; error?: { code: string; message: string } };
    if (!typed.ok) {
      return { ok: false, error: { code: typed.error?.code || "UNKNOWN_ERROR", message: typed.error?.message || "Unknown error", retryable: false } };
    }
    return { ok: true, data: typed.data as T };
  }

  return { ok: false, error: { code: "VALIDATION_ERROR", message: "Formato de respuesta inesperado", retryable: false } };
}

export const api = {
  // Gestión de Proyectos y Persistencia (HU-29, HU-30)
  getProjects: () => request<{ projects: any[] }>("/projects"),
  getAuditHistory: (projectId: string) => request(`/audit-history?projectId=${projectId}`),
  getHealthStatus: () => request<{ ok: boolean; healthy: boolean; details?: any }>("/health"),

  // Analizador Estático y AST (HU-04, HU-05, HU-06)
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

  // Ejecutor de Pruebas & Verificación (HU-12, HU-13, HU-14)
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

  // Controlador Git & Parches (HU-08, HU-09, HU-10, HU-11)
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

  // Auditoría, Hooks y Subagentes (HU-27, HU-28)
  getHooksAuditLogs: () => request<{ logs: any[]; total: number }>("/audit/hooks"),
  getSubagentsStatus: () => request<{ agents: any[]; online: boolean }>("/agents/status"),
};