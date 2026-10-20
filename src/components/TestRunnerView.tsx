import { useState } from "react";
import { api } from "../services/api";

type RunnerType = "jest" | "pytest";

interface TestCase {
  id: string;
  path: string;
  name: string;
  status: "passed" | "failed" | "skipped" | "todo";
  durationMs?: number | null;
  failureMessage?: string | null;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  todo: number;
}

interface RunTestsOutput {
  runId: string;
  runner: RunnerType;
  status: "passed" | "failed" | "timeout" | "error" | "cancelled";
  exitCode?: number | null;
  durationMs: number;
  summary: TestSummary;
  cases: TestCase[];
  stdout: string;
  stderr: string;
  truncated: boolean;
  complete: boolean;
  startedAt: string;
  finishedAt: string;
  workspaceStateHash: string;
  configurationHash: string;
}

export function TestRunnerView() {
  const [runner, setRunner] = useState<RunnerType>("jest");
  const [targets, setTargets] = useState<string[]>([]);
  const [timeoutMs, setTimeoutMs] = useState<number>(30000);
  const [running, setRunning] = useState<boolean>(false);
  const [result, setResult] = useState<RunTestsOutput | null>(null);
  const [comparison, setComparison] = useState<{
    resolvedFailures: string[];
    newFailures: string[];
    missingTests: string[];
    comparable: boolean;
    verdict: "success" | "regression" | "inconclusive";
  } | null>(null);

  const runTests = async () => {
    setRunning(true);
    try {
      const result = await api.runTests(runner, targets.length > 0 ? targets : undefined, timeoutMs);
      if (!result.ok) throw new Error(result.error?.message || "Error desconocido");
      setResult(result.data);
    } catch (e: any) {
      alert(`Error al ejecutar pruebas: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const compareRuns = async () => {
    if (!result) {
      alert("Primero ejecuta un test para obtener un runId");
      return;
    }
    setRunning(true);
    try {
      const comp = await api.compareTestRuns(result.runId, result.runId);
      if (!comp.ok) throw new Error(comp.error?.message || "Error desconocido");
      setComparison(comp.data);
    } catch (e: any) {
      alert(`Error al comparar ejecuciones: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controles de runner */}
      <div className="bg-gray-900/50 rounded-lg p-4">
        <div className="flex gap-2 mb-3">
          <select
            value={runner}
            onChange={(e) => setRunner(e.target.value as RunnerType)}
            className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="jest">Jest</option>
            <option value="pytest">pytest</option>
          </select>
          <input
            type="text"
            value={targets.join(",") || ""}
            onChange={(e) => setTargets(e.target.value.split(",").map((t: string) => t.trim()).filter((t: string) => t.length > 0))}
            placeholder="Directorios objetivo (opcional)"
            className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 w-40 text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            type="number"
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(Number(e.target.value))}
            min="1000"
            max="300000"
            step="1000"
            placeholder="Timeout ms"
            className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 w-24 text-sm focus:outline-none focus:border-indigo-500 ml-3"
          />
          <button
            onClick={runTests}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={running}
          >
            {running ? "Ejecutando..." : "Ejecutar pruebas"}
          </button>
        </div>

        {running && <p className="text-sm text-gray-400">Ejecutando pruebas en {runner}...</p>}

        {result && !running && (
          <div className="mt-4 p-4 rounded-lg bg-gray-800/50">
            <p className="font-medium text-white">Resumen</p>
            <div className="mt-2 grid grid-cols-5 gap-2">
              <div className="col-span-1 text-center">
                <p className="text-2xl font-bold text-green-400">{result.summary.passed}</p>
                <p className="text-xs text-gray-400">Aprobados</p>
              </div>
              <div className="col-span-1 text-center">
                <p className="text-2xl font-bold text-red-400">{result.summary.failed}</p>
                <p className="text-xs text-gray-400">Fallidos</p>
              </div>
              <div className="col-span-1 text-center">
                <p className="text-2xl font-bold text-yellow-400">{result.summary.skipped}</p>
                <p className="text-xs text-gray-400">Omitidos</p>
              </div>
              <div className="col-span-1 text-center">
                <p className="text-2xl font-bold text-purple-400">{result.summary.todo}</p>
                <p className="text-xs text-gray-400">Pendientes</p>
              </div>
              <div className="col-span-1 text-center">
                <p className="text-2xl font-bold text-indigo-400">{result.runner}</p>
                <p className="text-xs text-gray-400">Runner</p>
              </div>
            </div>

            {result.cases.length > 0 && (
              <p className="mt-2 text-sm text-gray-300">Tests: {result.cases.length} ({result.summary.passed} passed, {result.summary.failed} failed)</p>
            )}

            <div className="mt-3">
              <button
                onClick={compareRuns}
                className="px-4 py-2 bg-teal-600 text-white rounded-md font-medium hover:bg-teal-500 transition-colors"
                disabled={!result || comparison}
              >
                Comparar runs
              </button>
</div>
        )}
      </div>

      {/* Panel de comparación */}
      {comparison && (
        <div className="bg-gray-900/50 rounded-lg p-6">
          <p className="font-medium text-white mb-4">Veredicto: <span className={comparison.verdict === "success" ? "text-green-400" : comparison.verdict === "regression" ? "text-red-500" : "text-yellow-400"}>{comparison.verdict}</span></p>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div>
              <p className="font-semibold text-gray-300">Resueltos</p>
              <p className="text-3xl font-bold text-green-400">{comparison.resolvedFailures.length}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-300">Nuevos fallos</p>
              <p className="text-3xl font-bold text-red-500">{comparison.newFailures.length}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-300">Tests ausentes</p>
              <p className="text-3xl font-bold text-yellow-500">{comparison.missingTests.length}</p>
            </div>
          </div>

          {comparison.comparable && (
            <p className="mt-4 text-sm text-gray-400">La comparación es comparable: no hay regresiones.</p>
          )}

          {!comparison.comparable && (
            <p className="mt-4 text-sm text-yellow-400">La comparación no es comparable (hay diferencias entre baseline y candidato).</p>
          )}
        </div>
      )}
    </div>
  );
}