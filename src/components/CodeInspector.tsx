import { useState } from "react";
import { api } from "../services/api";

type CheckType = "syntax" | "semantic" | "lint";
type Severity = "error" | "warning" | "info";

interface Diagnostic {
  path: string;
  source: "typescript" | "eslint" | "parser";
  code: string;
  severity: Severity;
  message: string;
  range: { start: { line: number; column: number }; end: { line: number; column: number } } | null;
}

interface CodeSymbol {
  path: string;
  name: string;
  kind: "function" | "method" | "class" | "interface" | "type" | "variable" | "module";
  signature: string;
  range: { start: { line: number; column: number }; end: { line: number; column: number } };
}

interface Dependency {
  from: string;
  specifier: string;
  resolvedPath?: string;
  external?: boolean;
  typeOnly?: boolean;
}

export function CodeInspector() {
  const [mode, setMode] = useState<"readFile" | "analyze" | "symbol">("readFile");
  const [filePath, setFilePath] = useState<string>("");
  const [startLine, setStartLine] = useState<number>(1);
  const [endLine, setEndLine] = useState<number>(50);
  const [checks, setChecks] = useState<CheckType[]>(["syntax"]);
  const [symbolPath, setSymbolPath] = useState<string>("");
  const [symbolLine, setSymbolLine] = useState<number>(1);

  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [affectedSymbols, setAffectedSymbols] = useState<CodeSymbol[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [analyzedFiles, setAnalyzedFiles] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<CodeSymbol | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const loadContent = async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      if (mode === "readFile") {
        const result = await api.readFileContext(filePath, startLine, endLine);
        if (!result.ok) throw new Error(result.error?.message || "Error desconocido");
        setError(undefined);
      } else if (mode === "analyze") {
        const result = await api.analyzeCode([filePath], checks);
        if (!result.ok) throw new Error(result.error?.message || "Error desconocido");
        setDiagnostics(
          result.data.diagnostics.map((d: any) => ({
            path: d.path,
            source: d.source,
            code: d.code,
            severity: d.severity,
            message: d.message,
            range: d.range
              ? { start: { line: d.range.start.line, column: d.range.start.column }, end: { line: d.range.end.line, column: d.range.end.column } }
              : null,
          }))
        );
        setAffectedSymbols(
          result.data.affectedSymbols.map((s: any) => ({
            path: s.path,
            name: s.name,
            kind: s.kind,
            signature: s.signature,
            range: {
              start: { line: s.range.start.line, column: s.range.start.column },
              end: { line: s.range.end.line, column: s.range.end.column },
            },
          }))
        );
        setDependencies(
          result.data.dependencies.map((d: any) => ({
            from: d.from,
            specifier: d.specifier,
            resolvedPath: d.resolvedPath,
            external: d.external,
            typeOnly: d.typeOnly,
          }))
        );
        setAnalyzedFiles(result.data.analyzedFiles);
      } else if (mode === "symbol") {
        const result = await api.getSymbolContext(symbolPath, symbolLine);
        if (!result.ok) throw new Error(result.error?.message || "Error desconocido");
        setSelectedSymbol({
          path: result.data.symbol.path,
          name: result.data.symbol.name,
          kind: result.data.symbol.kind,
          signature: result.data.symbol.signature,
          range: {
            start: { line: result.data.symbol.range.start.line, column: result.data.symbol.range.start.column },
            end: { line: result.data.symbol.range.end.line, column: result.data.symbol.range.end.column },
          },
        });
        setDependencies(
          result.data.imports.map((imp: any) => ({
            from: imp.from,
            specifier: imp.specifier,
            resolvedPath: imp.resolvedPath,
            external: imp.external,
            typeOnly: imp.typeOnly,
          }))
        );
        setAnalyzedFiles([symbolPath]);
      }
      setIsLoading(false);
    } catch (e: any) {
      setError(e.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-700 bg-gray-900/50 px-4 py-3 flex gap-2">
        <button
          onClick={() => setMode("readFile")}
          className={mode === "readFile"
            ? "bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium"
            : "text-gray-300 hover:text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"}
        >
          Lectura de Archivo
        </button>
        <button
          onClick={() => setMode("analyze")}
          className={mode === "analyze"
            ? "bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium"
            : "text-gray-300 hover:text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"}
        >
          Análisis AST ({checks.length > 0 ? checks.join(", ") : "ningún check"})
        </button>
        <button
          onClick={() => setMode("symbol")}
          className={mode === "symbol"
            ? "bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium"
            : "text-gray-300 hover:text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"}
        >
          Contexto de Símbolo
        </button>
      </div>

      <div className="bg-gray-900/50 rounded-lg p-4">
        {mode === "readFile" && (
          <div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="Ruta del archivo..."
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 w-40 text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={loadContent}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? "Cargando..." : "Analizar"}
              </button>
            </div>

            {isLoading && <p className="text-sm text-gray-400">Cargando contenido...</p>}

            {!isLoading && !error && (
              <div className="mt-4 space-y-3 text-sm">
                <p className="font-medium text-gray-200">Archivo: {filePath}</p>
                <p className="font-medium text-gray-200">Línea {startLine} - {endLine}</p>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-600/30 border border-red-600">
                <p className="text-red-400 text-sm">Error: {error}</p>
              </div>
            )}
          </div>
        )}

        {mode === "analyze" && (
          <div>
            <div className="flex gap-2 mb-3">
              <select
                multiple
                onChange={(e) => setChecks(Array.from(e.target.selectedOptions).map((o: any) => o.value as CheckType))}
                className="bg-gray-800 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
                style={{ height: "auto" }}
              >
                <option value="syntax">Sintaxis</option>
                <option value="semantic">Semántica</option>
                <option value="lint">ESLint</option>
              </select>
              <button
                onClick={loadContent}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? "Analizando..." : "Ejecutar análisis"}
              </button>
            </div>

            {isLoading && <p className="text-sm text-gray-400 mt-4">Ejecutando análisis...</p>}

            {!isLoading && diagnostics.length > 0 && (
              <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
                {diagnostics.map((d: Diagnostic, i: number) => (
                  <div
                    key={i}
                    className={d.severity === "error"
                      ? "bg-red-600/30 border-l-4 border-red-500"
                      : d.severity === "warning"
                        ? "bg-yellow-600/30 border-l-4 border-yellow-500"
                        : "bg-green-600/30 border-l-4 border-green-500"
                    }
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-medium text-white ${d.severity === "error" ? "text-red-400" : d.severity === "warning" ? "text-yellow-400" : "text-green-400"}`}>
                        {d.code} - {d.severity}
                      </span>
                      <span className="text-xs text-gray-500">{d.path}</span>
                    </div>
                    <p className="text-gray-300 text-truncate line-clamp-3">{d.message}</p>
                    {d.range?.start.line > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Línea {d.range.start.line}:{d.range.start.column} - {d.range.end.line}:{d.range.end.column}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {diagnostics.length === 0 && affectedSymbols.length === 0 && (
              <p className="text-sm text-gray-500 mt-4">No se encontraron diagnósticos con los checks seleccionados.</p>
            )}

            {affectedSymbols.length > 0 && (
              <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">
                {affectedSymbols.map((s: CodeSymbol, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-gray-800/50 border border-gray-600">
                    <div className="font-medium text-white">{s.name}</div>
                    <p className="text-xs text-gray-400 mt-1">{s.signature}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Línea {s.range.start.line}:{s.range.start.column} - {s.range.end.line}:{s.range.end.column}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {dependencies.length > 0 && (
              <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">
                {dependencies.map((d: Dependency, i: number) => (
                  <div key={i} className="p-2 rounded bg-gray-700 text-xs">
                    <span className="font-mono text-gray-300">{d.from}</span>
                    <span className="ml-2">{d.specifier}{d.resolvedPath ? ` → ${d.resolvedPath}` : ""}{d.external ? " (external)" : ""}{d.typeOnly ? " (type-only)" : ""}</span>
                  </div>
                ))}
              </div>
            )}

            {analyzedFiles.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">Archivos analizados: {analyzedFiles.length}</p>
            )}
          </div>
        )}

        {mode === "symbol" && (
          <div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={symbolPath}
                onChange={(e) => setSymbolPath(e.target.value)}
                placeholder="Ruta del archivo..."
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 w-40 text-sm focus:outline-none focus:border-indigo-500"
              />
              <input
                type="number"
                value={symbolLine}
                onChange={(e) => setSymbolLine(Number(e.target.value))}
                min="1"
                placeholder="Número de línea"
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 w-24 text-sm focus:outline-none focus:border-indigo-500 ml-3"
              />
              <button
                onClick={loadContent}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? "Cargando..." : "Obtener contexto"}
              </button>
            </div>

            {isLoading && <p className="text-sm text-gray-400 mt-4">Cargando contexto de símbolo...</p>}

            {isLoading && !error && selectedSymbol && (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="font-medium text-white">Símbolo: {selectedSymbol.name}</p>
                  <p className="text-gray-400">Tipo: {selectedSymbol.kind}</p>
                  <p className="text-gray-400 mt-1">{selectedSymbol.signature}</p>
                  <p className="text-gray-500 text-truncate line-clamp-2">
                    Ubicación: Línea {selectedSymbol.range.start.line}:{selectedSymbol.range.start.column} - {selectedSymbol.range.end.line}:{selectedSymbol.range.end.column}
                  </p>
                </div>

                {dependencies.length > 0 && (
                  <div>
                    <p className="font-medium text-white">Importaciones ({dependencies.length})</p>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {dependencies.map((d: any, i: number) => (
                        <div key={i} className="p-2 rounded bg-gray-700 text-xs">
                          <span className="font-mono text-gray-300">{d.from}</span>
                          <span>{d.specifier}{d.resolvedPath ? ` → ${d.resolvedPath}` : ""}{d.external ? " (external)" : ""}{d.typeOnly ? " (type-only)" : ""}</span>
                        </div>
                      ))
                    </div>
                  </div>
                )}

                {selectedSymbol.references?.length > 0 && (
                  <div>
                    <p className="font-medium text-white">Referencias ({selectedSymbol.references.length})</p>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {selectedSymbol.references.map((ref: any, i: number) => (
                        <div key={i} className="p-2 rounded bg-gray-700 text-xs">
                          <span className="font-mono text-gray-300">{ref.path}</span>
                          <span className="text-xs block mt-1">Línea {ref.range.start.line}:{ref.range.start.column} - {ref.range.end.line}:{ref.range.end.column}</span>
                        </div>
                      ))
                    </div>
                  </div>
                )} 
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-600/30 border border-red-600">
                <p className="text-red-400 text-sm">Error: {error}</p>
              </div>
            )}

            {!selectedSymbol && isLoading && <p className="text-sm text-gray-400 mt-4">Buscando contexto de símbolo...</p>}
          </div>
        )}
      </div>
    </div>
  );
}