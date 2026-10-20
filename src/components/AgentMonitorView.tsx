import { useState, useEffect } from "react";
import { api } from "../services/api";

export interface HookEvent {
  id: string;
  timestamp: string;
  event: "blocked" | "allowed" | "warning";
  category: "secret" | "path" | "file" | "permission";
  message: string;
  details?: string;
}

interface SubagentStatus {
  id: string;
  name: string;
  status: "idle" | "working" | "error" | "offline";
  task?: string;
  progress?: number;
  result?: string;
}

type ResultType = {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string; retryable?: boolean; details?: unknown };
};

interface AgentMonitorProps {
  onResult?: (result: ResultType) => void;
  backendOk?: boolean;
}

export function AgentMonitorView({ backendOk }: AgentMonitorProps) {
  const [hookEvents, setHookEvents] = useState<HookEvent[]>([]);
  const [subagents, setSubagents] = useState<SubagentStatus[]>([]);
  const [consoleInput, setConsoleInput] = useState<string>("");

  useEffect(() => {
    fetchInitialState();
  }, []);

  const fetchInitialState = async () => {
    try {
      const [hooks, agents] = await Promise.all([
        api.getHooksAuditLogs(),
        api.getSubagentsStatus(),
      ]);
      if (hooks.ok) setHookEvents(hooks.data.logs);
      if (agents.ok) setSubagents(agents.data.agents);
    } catch (e: any) {
      console.error("Error fetching audit/logs:", e);
    }
  };

  const simulateRealTimeEvent = () => {
    const categories: ("secret" | "path" | "file" | "permission")[] = ["secret", "path", "file", "permission"];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const isBlockedRandom = Math.random() > 0.5;

    const events: HookEvent[] = [
      {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        event: isBlockedRandom ? "blocked" : "allowed",
        category: randomCategory,
        message: `Evento ${isBlockedRandom ? "bloqueado" : "permitido"}: ${["token secreta en .env", "ruta fuera del workspace", "acceso a archivo sensible"][Math.floor(Math.random() * 3)]}`,
        details: `Detalle técnico ${Math.random().toString(36).substring(2, 10)}`,
      },
    ];
    setHookEvents((prev) => [...prev, ...events].slice(-20));
  };

  useEffect(() => {
    const interval = setInterval(simulateRealTimeEvent, 3000);
    return () => clearInterval(interval);
  }, []);

  const sendConsoleCommand = async (command: string) => {
    setConsoleInput("");
    console.log("Comando de subagent:", command);
    simulateRealTimeEvent();
  };

  return (
    <div className="space-y-6">
      {backendOk === false && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-400 text-xs">
          Nota: El servicio de backend no responde o está fuera de línea.
        </div>
      )}

      {/* Consola de Eventos en Tiempo Real */}
      <section className="bg-gray-900/50 rounded-lg p-6 mb-6 border border-gray-800">
        <h2 className="font-medium text-white mb-4">Consola de Eventos en Tiempo Real</h2>
        <div className="h-[400px] overflow-y-auto p-3 space-y-2 bg-gray-950/40 rounded-md border border-gray-800">
          {hookEvents.map((event: HookEvent, i: number) => {
            const isBlocked = event.event === "blocked";
            const isAllowed = event.event === "allowed";
            const eventText =
              isBlocked ? "BLOQUEADO" : isAllowed ? "PERMITIDO" : "ADVERTENCIA";
            const eventColor =
              isBlocked
                ? "bg-red-500/10 border border-red-500/20 p-3 rounded"
                : isAllowed
                  ? "bg-green-500/10 border border-green-500/20 p-3 rounded"
                  : "bg-yellow-500/10 border border-yellow-500/20 p-3 rounded";

            return (
              <div key={i} className={eventColor}>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs text-gray-400">{event.timestamp}</span>
                  <span className={`font-medium rounded px-2 py-0.5 text-xs ${isBlocked ? "text-red-400" : isAllowed ? "text-green-400" : "text-yellow-400"}`}>
                    {eventText}
                  </span>
                </div>
                <p className="text-gray-300 text-sm line-clamp-2">{event.message}</p>
                {event.details && (
                  <p className="text-xs text-gray-500 mt-1">{event.details}</p>
                )}
              </div>
            );
          })}

          {hookEvents.length === 0 && (
            <p className="text-gray-500 text-sm">No hay eventos aún</p>
          )}
        </div>
      </section>

      {/* Grid de Subagentes */}
      <section className="bg-gray-900/50 rounded-lg p-6 border border-gray-800">
        <h2 className="font-medium text-white mb-4">Estado de Subagentes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subagents.map((agent: SubagentStatus) => {
            const borderMap: Record<string, string> = {
              idle: "border-l-green-500",
              working: "border-l-yellow-500",
              error: "border-l-red-500",
              offline: "border-l-gray-500",
            };

            const borderClass = borderMap[agent.status] || "border-l-gray-500";

            return (
              <div
                key={agent.id}
                className={`rounded-lg p-4 bg-gray-800/40 border border-gray-700/60 border-l-4 ${borderClass} flex flex-col justify-between space-y-3`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full animate-pulse ${agent.status === "idle"
                        ? "bg-green-500"
                        : agent.status === "working"
                          ? "bg-yellow-500"
                          : agent.status === "error"
                            ? "bg-red-500"
                            : "bg-gray-500"
                        }`}
                    />
                    <p className="font-medium text-white text-sm">{agent.name}</p>
                  </div>
                  <span className="text-xs uppercase px-2 py-0.5 rounded bg-gray-700/50 text-gray-300">
                    {agent.status}
                  </span>
                </div>

                {agent.task && (
                  <p className="text-xs text-gray-300">Tarea: {agent.task}</p>
                )}

                {agent.progress !== undefined && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progreso</span>
                      <span>{agent.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-full rounded-full ${agent.progress > 80
                          ? "bg-green-500"
                          : agent.progress > 50
                            ? "bg-yellow-500"
                            : "bg-red-500"
                          }`}
                        style={{ width: `${agent.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-4 mt-6 border-t border-gray-700/60 flex gap-6 text-xs text-gray-400">
          <span>Total: <strong className="text-white">{subagents.length}</strong></span>
          <span>Idle: <strong className="text-green-400">{subagents.filter((a) => a.status === "idle").length}</strong></span>
          <span>Trabajando: <strong className="text-yellow-400">{subagents.filter((a) => a.status === "working").length}</strong></span>
        </div>
      </section>

      {/* Consola de comandos */}
      <section className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={consoleInput}
            onChange={(e) => setConsoleInput(e.target.value)}
            placeholder="Comando para subagent (ej: analizar src/shared/)"
            className="flex-1 bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
          />
          <button
            onClick={() => sendConsoleCommand(consoleInput)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!consoleInput.trim()}
          >
            Enviar
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Los subagentes ejecutan tareas determinísticas basadas en los contratos del motor.
        </p>
      </section>
    </div>
  );
}