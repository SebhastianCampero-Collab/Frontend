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

export function AgentMonitorView() {
  const [hookEvents, setHookEvents] = useState<HookEvent[]>([]);
  const [subagents, setSubagents] = useState<SubagentStatus[]>([]);
  const [consoleInput, setConsoleInput] = useState<string>("");
  const [scrollPosition, setScrollPosition] = useState<number>(0);

  // Cargar estado inicial
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

  // Simular evento en tiempo real (en producción vendría vía WebSocket)
  const simulateRealTimeEvent = () => {
    const events: HookEvent[] = [
      {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        event: Math.random() > 0.5 ? "blocked" : "allowed",
        category: ["secret", "path", "file"][Math.floor(Math.random() * 3)],
        message: `Evento ${Math.random() > 0.5 ? "bloqueado" : "permitido"}: ${["token secreta en .env", "ruta fuera del workspace", "acceso a archivo sensible"][Math.floor(Math.random() * 3)]}`,
        details: `Detalle técnico ${Math.random().toString(36).substring(2, 10)}`,
      },
    ];
    setHookEvents((prev) => [...prev, ...events].slice(-20)); // Mantener últimos 20
  };

  // Auto-actualizar cada 3 segundos
  useEffect(() => {
    const interval = setInterval(simulateRealTimeEvent, 3000);
    return () => clearInterval(interval);
  }, []);

  const sendConsoleCommand = async (command: string) => {
    setConsoleInput("");
    // En un sistema real, esto enviaría el comando a un subagent
    console.log("Comando de subagent:", command);
    // Podríamos agregar un evento local
    simulateRealTimeEvent();
  };

  return (
    <div className="space-y-6">
      {/* Consola de eventos en tiempo real */}
      <div className="bg-gray-900/50 rounded-lg h-[600px] overflow-auto">
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-medium text-white">Consola de Eventos en Tiempo Real</h3>
          <span className="text-xs text-gray-400">Actualización automática cada 3s</span>
        </div>

        <div className="h-[500px] overflow-y-auto p-3 space-y-2">
          {hookEvents.map((event: HookEvent, i: number) => {
            const eventColor =
              event.event === "blocked"
                ? "bg-red-500/20 border-red-500/20"
                : event.event === "allowed"
                  ? "bg-green-500/20 border-green-500/20"
                  : "bg-yellow-500/20 border-yellow-500/20";
            const eventText =
              event.event === "blocked"
                ? "BLOQUEADO"
                : event.event === "allowed"
                    ? "PERMITIDO"
                    : "ADVERTENCIA";

            return (
              <div
                key={i}
                className={`${eventColor} rounded-lg p-3 mb-2 transition-all duration-200`}
                style={{ animation: `fadeIn 0.3s ease ${i * 0.05}s` }}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs text-gray-400">{event.timestamp}</span>
                  <span className={`font-medium rounded px-2 py-0.5 text-xs ${event.event === "blocked" ? "text-red-400" : event.event === "allowed" ? "text-green-400" : "text-yellow-400"}>
                    {eventText}
                  </span>
                </div>
                <p className="text-gray-300 text-truncate line-clamp-2">{event.message}</p>
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
      </div>

      {/* Estado de subagentes */}
      <div className="grid grid-cols-2 gap-4">
        {subagents.map((agent: SubagentStatus) => {
          const statusColor =
            agent.status === "idle"
              ? "bg-green-500/20 text-green-400"
              : agent.status === "working"
                ? "bg-yellow-500/20 text-yellow-400"
                : agent.status === "error"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-gray-500/20 text-gray-400";

          return (
            <div
              key={agent.id}
              className={`
                rounded-lg p-3 flex items-center gap-3 ${statusColor}
                border-l-4 ${agent.status === "idle" ? "bg-green-500" : agent.status === "working" ? "bg-yellow-500" : agent.status === "error" ? "bg-red-500" : "bg-gray-500"}
              `}
            >
              <div className="w-3 h-3 rounded-full ${agent.status === "idle" ? "bg-green-500" : agent.status === "working" ? "bg-yellow-500" : agent.status === "error" ? "bg-red-500" : "bg-gray-500"} animate-pulse" />
              <div>
                <p className="font-medium text-white">{agent.name}</p>
                <p className="text-xs text-gray-300">{agent.status}</p>
              </div>
              {agent.task && (
                <p className="text-xs text-gray-300 mt-1">{agent.task}</p>
              )}
              {agent.progress !== undefined && (
                <div className="mt-1">
                  <span className="text-xs text-gray-300">Progreso: </span>
                  <div className="w-full bg-gray-700 rounded-h full-height">
                    <div
                      className={`h-2 rounded-full bg-${agent.progress > 80 ? "green" : agent.progress > 50 ? "yellow" : "red-500"} transition-colors ease-in-out`}
                      style={{ width: `${agent.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Estadísticas rápidas */}
        <div className="pt-6 border-t border-gray-700">
          <p className="text-xs text-gray-400">Total: {subagents.length}</p>
          <p className="text-xs text-gray-400">Idle: {subagents.filter((a) => a.status === "idle").length}</p>
          <p className="text-xs text-gray-400">Trabajando: {subagents.filter((a) => a.status === "working").length}</p>
        </div>
      </div>

      {/* Panel de entrada de comandos */}
      <div className="bg-gray-900/50 rounded-lg p-4 mt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={consoleInput}
            onChange={(e) => setConsoleInput(e.target.value)}
            placeholder="Comando para subagent (ej: analizar src/shared/)"
            className="flex-1 bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => sendConsoleCommand(consoleInput)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!consoleInput.trim()}
          >
            Enviar
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Los subagentes ejecutan tareas determinísticas basadas en los contratos del motor.</p>
      </div>
    </div>
  );
}