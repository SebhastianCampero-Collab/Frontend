import { useState } from "react";
import { Header } from "./components/Header";
import { CodeInspector } from "./components/CodeInspector";
import { TestRunnerView } from "./components/TestRunnerView";
import { GitControlView } from "./components/GitControlView";
import { AgentMonitorView } from "./components/AgentMonitorView";
import { ResultDrawer } from "./components/ResultDrawer";

type ResultType = {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string; retryable?: boolean; details?: unknown };
};

const DEFAULT_API_URL = "http://localhost:3000/api";

const initialState = {
  selectedTab: "code-inspector" as const,
  resultDrawer: { visible: false, result: {} as ResultType, onClose: () => {} },
  backendOk: false,
};

type AppState = typeof initialState;

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [apiUrl, setApiUrl] = useState<string>(import.meta.env.VITE_API_URL || DEFAULT_API_URL);

  // Verificar salud del backend al montar
  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((data) => {
        setState((s) => ({ ...s, backendOk: data.ok === true }));
      })
      .catch(() => setState((s) => ({ ...s, backendOk: false })));
  }, [apiUrl]);

  const openResultDrawer = (result: ResultType) => {
    setState((s) => ({
      ...s,
      resultDrawer: { visible: true, result, onClose: () => setState((s2) => ({ ...s2, resultDrawer: { visible: false, result: {} as ResultType, onClose: () => {} } })) },
    }));
  };

  const closeResultDrawer = () =>
    setState((s) => ({ ...s, resultDrawer: { visible: false, result: {} as ResultType, onClose: () => {} } }));

  const tabs = [
    { key: "code-inspector", label: "Inspector Código & AST" },
    { key: "test-runner", label: "Runner Pruebas" },
    { key: "git-control", label: "Control Git & Diffs" },
    { key: "agent-monitor", label: "Monitor Agentes" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Header */}
      <Header onLogout={() => alert("Logout")} />

      {/* Main content area */}
      <main className="max-w-7xl mx-auto p-4">
        {/* Tabs navigation - wrapped in single div to avoid adjacent JSX */}
        <div className="bg-gray-900/50 rounded-lg mb-6 overflow-x-auto">
          <div className="flex border-b border-gray-700">
            {tabs.map((tab) => (
              <div
                key={tab.key}
                className={state.selectedTab === tab.key.key
                  ? "flex-1 bg-indigo-600 text-white px-4 py-2 rounded-l-lg border-b-2 border-indigo-600 font-medium"
                  : "flex-1 text-gray-300 hover:text-white px-4 py-2 rounded-l-lg hover:bg-gray-700 border-b-2 border-transparent transition-colors"}
              >
                {tab.label}
              </div>
            ))}
          </div>
        </div>

        {/* Content by tab */}
        <div className="space-y-6">
          {state.selectedTab === "code-inspector" && (
            <CodeInspector
              onResult={(result: ResultType) => openResultDrawer(result)}
              backendOk={state.backendOk}
            />
          )}

          {state.selectedTab === "test-runner" && (
            <TestRunnerView
              onResult={(result: ResultType) => openResultDrawer(result)}
              backendOk={state.backendOk}
            />
          )}

          {state.selectedTab === "git-control" && (
            <GitControlView
              onResult={(result: ResultType) => openResultDrawer(result)}
              backendOk={state.backendOk}
            />
          )}

          {state.selectedTab === "agent-monitor" && (
            <AgentMonitorView
              onResult={(result: ResultType) => openResultDrawer(result)}
              backendOk={state.backendOk}
            />
          )}
        </div>

        {/* Panel ResultDrawer siempre visible cuando está abierto */}
        {state.resultDrawer.visible && (
          <ResultDrawer
            visible={state.resultDrawer.visible}
            result={state.resultDrawer.result}
            onClose={closeResultDrawer}
          />
        )}
      </main>
    </div>
  );
}