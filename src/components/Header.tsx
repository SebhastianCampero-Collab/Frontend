import { useEffect, useState } from "react";

export interface HealthStatus {
  backendOk: boolean;
  workspaceName?: string;
}

export interface HeaderProps {
  onLogout?: () => void;
}

export function Header({ onLogout }: HeaderProps) {
  const [healthStatus, setHealthStatus] = useState<{ backendOk: boolean; updating: boolean }>({ backendOk: false, updating: true });
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/health`)
      .then((res) => res.json())
      .then((data) => {
        setHealthStatus({ backendOk: data.ok === true, updating: false });
        if (data.data?.workspaceName) setWorkspaceName(data.data.workspaceName);
      })
      .catch(() => setHealthStatus({ backendOk: false, updating: false }));
  }, []);

  const heartbeatInterval = setInterval(() => {
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/health`)
      .then((res) => res.json())
      .then((data) => setHealthStatus({ backendOk: data.ok === true, updating: false }))
      .catch(() => setHealthStatus({ backendOk: false, updating: false }));
  }, 8000);

  return (
    <header className="border-b border-gray-700 bg-gray-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-indigo-500">DevGuardian</span>
          <span className="text-sm text-gray-300">🛡️</span>
          <h2 className="text-xl font-medium text-white">Dashboard de Operaciones</h2>
        </div>

        <div className="flex items-center gap-4">
          {workspaceName ? (
            <div className="flex items-center gap-2 rounded-full bg-gray-800/50 p-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500" title="Workspace activo" />
              <span className="text-sm text-gray-300" title={workspaceName}>{workspaceName}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full bg-gray-800/50 p-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Sin workspace" />
              <span className="text-xs text-gray-400" title="Sin workspace">—</span>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={onLogout}
              className="text-sm text-gray-400 hover:text-white transition-colors"
              title="Cerrar sesión"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}