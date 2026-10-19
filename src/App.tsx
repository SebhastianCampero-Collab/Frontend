import { useState } from "react";

type ToolName =
  | "read_file_context"
  | "analyze_code"
  | "get_symbol_context"
  | "git_status"
  | "git_create_fix_branch"
  | "git_begin_attempt"
  | "git_apply_patch"
  | "git_diff"
  | "git_commit_fix"
  | "git_rollback_attempt"
  | "run_tests"
  | "compare_test_runs";

interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

const handlerMap: Record<ToolName, (params: Record<string, unknown>) => Promise<ToolResult>> = {
  read_file_context: async (params) => {
    // Placeholder - will be connected to backend
    return { ok: true, data: { path: (params as any).path, content: "..." } };
  },
  analyze_code: async (params) => {
    return { ok: true, data: { analysisId: "id1", diagnostics: [] } };
  },
  get_symbol_context: async (params) => {
    return { ok: true, data: { symbol: "func", range: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } } } };
  },
  git_status: async () => {
    return { ok: true, data: { branch: "main", headCommit: "abc", clean: true, staged: [], modified: [], untracked: [], conflicted: false } };
  },
  git_create_fix_branch: async (params) => {
    return { ok: true, data: { sessionId: "s1", branch: "fix/refactor-xyz", baseBranch: "main", baseCommit: "abc" } };
  },
  git_begin_attempt: async (params) => {
    return { ok: true, data: { attemptId: "a1", checkpointCommit: "abc" } };
  },
  git_apply_patch: async (params) => {
    return { ok: true, data: { applied: true, changedFiles: [], diffHash: "xyz" } };
  },
  git_diff: async (params) => {
    return { ok: true, data: { diff: "", diffHash: "xyz", changedFiles: [], insertions: 0, deletions: 0 } };
  },
  git_commit_fix: async (params) => {
    return { ok: true, data: { commit: "xyz", branch: "fix/refactor-xyz", files: [] } };
  },
  git_rollback_attempt: async (params) => {
    return { ok: true, data: { restoredCommit: "abc", revertedFiles: [], branch: "fix/refactor-xyz", clean: true } };
  },
  run_tests: async (params) => {
    const runner = (params as any).runner || "jest";
    return {
      ok: true,
      data: {
        runId: "r1",
        runner,
        status: "passed",
        complete: true,
        exitCode: 0,
        signal: null,
        durationMs: 2450,
        summary: "3 passed, 0 failed, 0 skipped",
        cases: [{ id: "test1", status: "passed", title: "test1" }, { id: "test2", status: "passed", title: "test2" }],
        stdout: "",
        stderr: "",
        outputTruncated: false,
        fingerprint: "hash1",
        configurationHash: "hash2",
        createdAt: new Date().toISOString(),
      },
    };
  },
  compare_test_runs: async (params) => {
    return {
      ok: true,
      data: {
        baselineRunId: (params as any).baselineRunId,
        candidateRunId: (params as any).candidateRunId,
        comparable: true,
        verdict: "success",
        resolvedFailures: [],
        newFailures: [],
        missingTests: [],
        message: "No regressions detected",
      },
    };
  },
};

function App() {
  const [status, setStatus] = useState<{ [key: string]: string }>({});
  const [results, setResults] = useState<Record<string, ToolResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const executeTool = async (name: ToolName, params: Record<string, unknown>) => {
    setLoading((prev) => ({ ...prev, [name]: true }));
    setStatus((prev) => ({ ...prev, [name]: "running" }));
    try {
      const result = await handlerMap[name](params);
      setResults((prev) => ({ ...prev, [name]: result }));
      setStatus((prev) => ({ ...prev, [name]: result.ok ? "success" : "error" }));
      if (!result.ok) {
        alert(`Error: ${result.error?.message || "Unknown error"}`);
      }
    } catch (e: any) {
      setResults((prev) => ({ ...prev, [name]: { ok: false, error: { code: "EXCEPTION", message: e.message } } }));
      setStatus((prev) => ({ ...prev, [name]: "error" }));
      alert(`Exception: ${e.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [name]: false }));
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ color: "#333" }}>
        DevGuardian Frontend
      </h1>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => executeTool("git_status", {})}
          style={{ marginRight: "10px", padding: "8px 16px" }}
        >
          Git Status
        </button>
        <button
          onClick={() => executeTool("git_create_fix_branch", { slug: "refactor-xyz", expectedHead: "main" })}
          style={{ marginRight: "10px", padding: "8px 16px" }}
        >
          Create Fix Branch
        </button>
        <button
          onClick={() => executeTool("git_begin_attempt", { sessionId: "s1" })}
          style={{ marginRight: "10px", padding: "8px 16px" }}
        >
          Begin Attempt
        </button>
        <button
          onClick={() => executeTool("git_apply_patch", { sessionId: "s1", attemptId: "a1", unifiedDiff: "//diff", expectedFileHashes: {} })}
          style={{ marginRight: "10px", padding: "8px 16px" }}
        >
          Apply Patch
        </button>
        <button
          onClick={() => executeTool("git_commit_fix", { sessionId: "s1", attemptId: "a1", message: "Fix", expectedDiffHash: "xyz", verificationRunId: "r1" })}
          style={{ marginRight: "10px", padding: "8px 16px" }}
        >
          Commit Fix
        </button>
        <button
          onClick={() => executeTool("git_rollback_attempt", { sessionId: "s1", attemptId: "a1" })}
          style={{ marginRight: "10px", padding: "8px 16px" }}
        >
          Rollback Attempt
        </button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => executeTool("run_tests", { runner: "jest", targets: ["src"], timeoutMs: 30000 })}
          style={{ marginRight: "10px", padding: "8px 16px" }}
        >
          Run Tests (Jest)
        </button>
        <button
          onClick={() => executeTool("run_tests", { runner: "pytest", targets: ["tests"], timeoutMs: 30000 })}
          style={{ marginRight: "10px", padding: "8px 16px" }}
        >
          Run Tests (pytest)
        </button>
        <button
          onClick={() => executeTool("compare_test_runs", { baselineRunId: "r1", candidateRunId: "r2" })}
          style={{ marginRight: "10px", padding: "8px 16px" }}
        >
          Compare Test Runs
        </button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => executeTool("read_file_context", { path: "src/shared/contracts.ts", startLine: 1, endLine: 50 })}
          style={{ marginRight: "10px", padding: "8px 16px" }}
        >
          Read File Context
        </button>
        <button
          onClick={() => executeTool("analyze_code", { paths: ["src/shared/contracts.ts"], checks: ["syntax", "semantic"] })}
          style={{ marginRight: "10x", padding: "8px 16px" }}
        >
          Analyze Code
        </button>
        <button
          onClick={() => executeTool("get_symbol_context", { path: "src/shared/contracts.ts", line: 1 })}
          style={{ marginRight: "10px", padding: "8px 16px" }}
        >
          Get Symbol Context
        </button>
      </div>

      <h2>Results</h2>
      <div>
        {Object.entries(results).map(([name, result]) => (
          <div key={name} style={{ marginBottom: "15px", border: "1px solid #ddd", borderRadius: "4px", padding: "10px" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#555" }}>{name}</h3>
            {result.ok ? (
              <pre style={{ whiteSpace: "pre-wrap", margin: "0" }}>{JSON.stringify(result.data, null, 2)}</pre>
            ) : (
              <div style={{ color: "red", margin: "10px 0" }}>
                <strong>Error:</strong> {result.error?.message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;