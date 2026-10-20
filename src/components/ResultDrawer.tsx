import { useState } from "react";

type ResultType = {
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
    details?: unknown;
  };
};

interface ResultDrawerProps {
  visible: boolean;
  result: ResultType;
  onClose: () => void;
}

export function ResultDrawer({ visible, result, onClose }: ResultDrawerProps) {
  const [expanded, setExpanded] = useState<boolean>(true);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900/90 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Resultado de la API (Result type)</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Vista de éxito */}
        {result.ok && result.data !== undefined && (
          <div className="mb-6 p-4 rounded-lg bg-green-600/20 border border-green-600">
            <p className="font-medium text-green-400">✓ OK</p>
            <pre className="text-gray-300 mt-1 whitespace-pre-wrap text-xs">
              {typeof result.data === "object" && result.data !== null
                ? JSON.stringify(result.data, null, 2)
                : String(result.data)}
            </pre>
          </div>
        )}

        {/* Vista de error */}
        {!result.ok && result.error && (
          <div className="mb-6 p-4 rounded-lg bg-red-600/20 border border-red-600">
            <p className="font-medium text-red-400">✗ Error</p>
            <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
              <div>
                <p className="font-semibold text-gray-300">Código</p>
                <p className="text-red-300">{result.error.code}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-300">Mensaje</p>
                <p className="text-red-300">{result.error.message}</p>
              </div>
            </div>
            {result.error.details !== undefined && (
              <div className="mt-3 p-3 rounded-lg bg-gray-800 text-xs">
                <p className="font-semibold text-gray-300">Detalles</p>
                <pre className="text-gray-300 whitespace-pre-wrap">
                  {typeof result.error.details === "object" && result.error.details !== null
                    ? JSON.stringify(result.error.details, null, 2)
                    : String(result.error.details)}
                </pre>
              </div>
            )}
            {result.error.retryable && (
              <p className="mt-2 text-yellow-400 text-sm">⚡ Reintentable</p>
            )}
          </div>
        )}

        {/* Formato JSON puro */}
        <div className="mt-6">
          <p className="text-sm text-gray-400 mb-2">Ver JSON crudo</p>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline mb-2 block"
          >
            {expanded ? "Contraer JSON" : "Expandir JSON"}
          </button>
          <pre
            className={`bg-gray-800 rounded-md p-4 text-xs overflow-auto ${expanded ? "max-h-[400px]" : "max-h-[200px]"}`}
          >
            {!expanded && (
              <code className="text-indigo-400">
                {JSON.stringify(result, null, 2).substring(0, 200) +
                  (JSON.stringify(result, null, 2).length > 200 ? "..." : "")}
              </code>
            )}
            {expanded && (
              <code className="text-gray-200">{JSON.stringify(result, null, 2)}</code>
            )}
          </pre>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}