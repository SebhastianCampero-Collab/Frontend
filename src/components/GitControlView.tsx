import { useState, useEffect } from "react";
import { api } from "../services/api";

type FixBranch = `fix/${string}`;

interface GitStatus {
  branch: string | null;
  headCommit?: string | null;
  clean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
}

type ResultType = {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string; retryable?: boolean; details?: unknown };
};

interface GitControlProps {
  onResult?: (result: ResultType) => void;
  backendOk?: boolean;
}

export function GitControlView({ onResult, backendOk }: GitControlProps) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [attemptId, setAttemptId] = useState<string>("");
  const [checkpointCommit, setCheckpointCommit] = useState<string | null>(null);
  const [fixBranch, setFixBranch] = useState<FixBranch>("fix/temp");
  const [, setBaseBranch] = useState<string>("");
  const [, setBaseCommit] = useState<string | null>(null);
  const [unifiedDiff, setUnifiedDiff] = useState<string>("");
  const [expectedFileHashes] = useState<Record<string, string | null>>({});
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [expectedDiffHash, setExpectedDiffHash] = useState<string>("");
  const [verificationRunId, setVerificationRunId] = useState<string>("");
  const [rollbackBranch, setRollbackBranch] = useState<FixBranch>("fix/temp");
  const [rollbackAttemptId, setRollbackAttemptId] = useState<string>("");
  const [applied, setApplied] = useState<boolean | null>(null);
  const [diffHash, setDiffHash] = useState<string>("");
  const [, setChangedFiles] = useState<string[]>([]);
  const [restoredCommit, setRestoredCommit] = useState<string | null>(null);
  const [revertedFiles, setRevertedFiles] = useState<string[]>([]);
  const [rollbackClean, setRollbackClean] = useState<boolean | null>(null);

  useEffect(() => {
    fetchGitStatus();
  }, []);

  const fetchGitStatus = async () => {
    try {
      const result = await api.getGitStatus();
      if (onResult) onResult(result);
      if (!result.ok) throw new Error(result.error?.message || "Error desconocido");
      setStatus(result.data);
    } catch (e: any) {
      console.error("Error fetching git status:", e);
    }
  };

  const handleCreateFixBranch = async () => {
    try {
      const result = await api.createFixBranch(fixBranch, status?.branch ?? "main");
      if (onResult) onResult(result);
      if (!result.ok) throw new Error(result.error?.message || "Error desconocido");
      const data = result.data;
      setSessionId(data.sessionId);
      setFixBranch(data.branch as FixBranch);
      setBaseBranch(data.baseBranch);
      setBaseCommit(data.baseCommit);
      alert(`Rama creada: ${data.branch}\nSession: ${data.sessionId}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleBeginAttempt = async () => {
    try {
      const result = await api.beginAttempt(sessionId);
      if (onResult) onResult(result);
      if (!result.ok) throw new Error(result.error?.message || "Error desconocido");
      const data = result.data;
      setAttemptId(data.attemptId);
      setCheckpointCommit(data.checkpointCommit);
      alert(`Intento iniciado: ${data.attemptId}\nCheckpoint: ${data.checkpointCommit}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleApplyPatch = async () => {
    try {
      const result = await api.applyPatch(sessionId, attemptId, unifiedDiff, expectedFileHashes);
      if (onResult) onResult(result);
      if (!result.ok) throw new Error(result.error?.message || "Error desconocido");
      const data = result.data;
      setApplied(data.applied);
      setDiffHash(data.diffHash);
      setChangedFiles(data.changedFiles);
      alert(`Parche ${data.applied ? "aplicado" : "no aplicado"}\nArchivos cambiados: ${data.changedFiles.join(", ")}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleCommitFix = async () => {
    try {
      const result = await api.commitFix(sessionId, attemptId, commitMessage, expectedDiffHash, verificationRunId);
      if (onResult) onResult(result);
      if (!result.ok) throw new Error(result.error?.message || "Error desconocido");
      const data = result.data;
      alert(`Commit confirmado:\n${data.commit}\nRama: ${data.branch}\nArchivos: ${data.files.join(", ")}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleRollback = async () => {
    try {
      const result = await api.rollbackAttempt(rollbackBranch, rollbackAttemptId);
      if (onResult) onResult(result);
      if (!result.ok) throw new Error(result.error?.message || "Error desconocido");
      const data = result.data;
      setRestoredCommit(data.restoredCommit);
      setRevertedFiles(data.revertedFiles);
      setRollbackClean(data.clean);
      alert(`Rollback completado:\n${data.restoredCommit}\nArchivos revertidos: ${data.revertedFiles.join(", ")}\nClean: ${data.clean}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {backendOk === false && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-400 text-xs">
          Nota: El servicio de backend no responde o está fuera de línea.
        </div>
      )}

      {/* Estado Git actual */}
      <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
        <p className="font-medium text-white mb-3 text-sm">Estado Actual de Git</p>
        {status ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-gray-800/40 p-3 rounded border border-gray-700/60">
              <p className="font-semibold text-gray-300 text-xs">Rama</p>
              <p className="font-medium text-white mt-1 text-sm">{status.branch || "Ninguna"}</p>
            </div>
            <div className="bg-gray-800/40 p-3 rounded border border-gray-700/60">
              <p className="font-semibold text-gray-300 text-xs">HEAD Commit</p>
              <p className="font-medium text-white mt-1 text-sm truncate">{status.headCommit || "Ninguno"}</p>
            </div>
            <div className="bg-gray-800/40 p-3 rounded border border-gray-700/60">
              <p className="font-semibold text-gray-300 text-xs">Clean</p>
              <p className={`font-medium mt-1 text-sm ${status.clean ? "text-green-400" : "text-red-400"}`}>{status.clean ? "Sí" : "No"}</p>
            </div>
            <div className="bg-gray-800/40 p-3 rounded border border-gray-700/60">
              <p className="font-semibold text-gray-300 text-xs">Modified</p>
              <p className="text-gray-300 mt-1 text-sm truncate">{status.modified.length > 0 ? status.modified.join(", ") : "Ninguno"}</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Cargando estado...</p>
        )}
      </div>

      {/* Sección: Crear rama fix */}
      <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 space-y-3">
        <p className="font-medium text-white text-sm">Crear rama fix/...</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={fixBranch.replace("fix/", "")}
            onChange={(e) => setFixBranch(`fix/${e.target.value}` as FixBranch)}
            placeholder="nombre-slug"
            className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 flex-1 text-sm focus:outline-none focus:border-indigo-500 text-white"
          />
          <button
            onClick={handleCreateFixBranch}
            className="px-4 py-2 bg-green-600 text-white rounded-md font-medium text-sm hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!fixBranch.includes("fix/")}
          >
            Crear rama
          </button>
        </div>
      </div>

      {/* Sección: Begin Attempt */}
      {sessionId ? (
        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 space-y-3">
          <p className="font-medium text-white text-sm">Iniciar Attempt</p>
          <button
            onClick={handleBeginAttempt}
            className="px-4 py-2 bg-orange-600 text-white rounded-md font-medium text-sm hover:bg-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Iniciar intento
          </button>
          {attemptId && <p className="text-xs text-gray-400 mt-1">Checkpoint: {checkpointCommit || "—"}</p>}
        </div>
      ) : null}

      {/* Sección: Apply Patch */}
      {attemptId ? (
        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 space-y-3">
          <p className="font-medium text-white text-sm">Aplicar Patch</p>
          <textarea
            value={unifiedDiff}
            onChange={(e) => setUnifiedDiff(e.target.value)}
            placeholder="Diff unificado..."
            rows={5}
            className="bg-gray-800 border border-gray-600 rounded-md w-full px-3 py-2 text-xs text-white resize-none focus:outline-none focus:border-indigo-500"
          ></textarea>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="font-semibold text-gray-300 text-xs mb-1">Hash esperado</p>
              <input
                type="text"
                value={expectedDiffHash}
                onChange={(e) => setExpectedDiffHash(e.target.value)}
                placeholder="hash SHA-256"
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>
            <div>
              <p className="font-semibold text-gray-300 text-xs mb-1">Hash por archivo</p>
              <input
                type="text"
                value={Object.keys(expectedFileHashes).length > 0 ? "configurada" : ""}
                readOnly
                placeholder="hashes (JSON opcional)"
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>
          </div>
          <button
            onClick={handleApplyPatch}
            className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!unifiedDiff.trim()}
          >
            Aplicar parche
          </button>
          {applied !== null && <p className="mt-2 text-xs text-gray-300">Parche: {applied ? "Aplicado" : "No aplicado"} (hash: {diffHash || "—"})</p>}
        </div>
      ) : null}

      {/* Sección: Commit Fix */}
      {attemptId ? (
        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 space-y-3">
          <p className="font-medium text-white text-sm">Confirmar Commit Fix</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="font-semibold text-gray-300 text-xs mb-1">Mensaje</p>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Descripción del fix"
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>
            <div>
              <p className="font-semibold text-gray-300 text-xs mb-1">Diff hash</p>
              <input
                type="text"
                value={expectedDiffHash}
                onChange={(e) => setExpectedDiffHash(e.target.value)}
                placeholder="hash diff esperado"
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="font-semibold text-gray-300 text-xs mb-1">Run ID verificación</p>
              <input
                type="text"
                value={verificationRunId}
                onChange={(e) => setVerificationRunId(e.target.value)}
                placeholder="ID run pruebas"
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>
            <div>
              <p className="font-semibold text-gray-300 text-xs mb-1">Attempt ID</p>
              <input
                type="text"
                value={attemptId}
                disabled
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-500 text-gray-400"
              />
            </div>
          </div>
          <button
            onClick={handleCommitFix}
            className="px-4 py-2 bg-purple-600 text-white rounded-md font-medium text-sm hover:bg-purple-500 transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar commit
          </button>
        </div>
      ) : null}

      {/* Sección: Rollback */}
      {sessionId ? (
        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 space-y-3">
          <p className="font-medium text-white text-sm">Revertir Cambios (Rollback)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="font-semibold text-gray-300 text-xs mb-1">Rama</p>
              <input
                type="text"
                value={rollbackBranch.replace("fix/", "")}
                onChange={(e) => setRollbackBranch(`fix/${e.target.value}` as FixBranch)}
                placeholder="nombre-slug"
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>
            <div>
              <p className="font-semibold text-gray-300 text-xs mb-1">Attempt ID</p>
              <input
                type="text"
                value={rollbackAttemptId}
                onChange={(e) => setRollbackAttemptId(e.target.value)}
                placeholder="ID attempt"
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>
          </div>
          <button
            onClick={handleRollback}
            className="px-4 py-2 bg-red-600 text-white rounded-md font-medium text-sm hover:bg-red-500 transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Revertir attempt
          </button>
          {restoredCommit && (
            <div className="mt-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700 space-y-1 text-xs">
              <p className="font-medium text-white">Rollback completado</p>
              <p className="text-gray-300">Restaurado: {restoredCommit || "—"}</p>
              <p className="text-gray-300">Archivos revertidos: {revertedFiles.length > 0 ? revertedFiles.join(", ") : "Ninguno"}</p>
              <p className={rollbackClean ? "text-green-400" : "text-red-400"}>{rollbackClean ? "Directorio clean" : "Queda trabajo ajeno"}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}