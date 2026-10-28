import type { Delegation } from '../types/contracts';
import { record } from '../types/contracts';

export const roleLabels = { diagnostic: 'Diagnóstico', verification: 'Verificación', 'patch-safety': 'Seguridad' } as const;
export type TraceRole = Delegation['role'] | 'all';
export interface TraceEvent {
  id: string; taskId: string; auditId: string; workerId: string | null; role: Delegation['role'];
  kind: 'delegated' | 'tool-start' | 'tool-end' | 'tool-record' | 'returned' | 'consumed';
  at: string | null; tool: string | null; status: string; durationMs: number | null; dispatched: boolean | null;
}
const timestamp = (value: unknown): string | null => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/u.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
const duration = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** Builds a metadata-only timeline. Missing timestamps and measurements stay missing. */
export function traceTelemetry(delegations: readonly Delegation[]): TraceEvent[] {
  const events: TraceEvent[] = [];
  for (const item of new Map(delegations.map((entry) => [entry.taskId, entry])).values()) {
    const common = { taskId: item.taskId, auditId: item.parentSessionId, workerId: item.subagentId, role: item.role };
    const snapshots = item.snapshots.map(record);
    const start = snapshots.find((entry) => entry['phase'] === 'delegated');
    events.push({ ...common, id: `${item.taskId}:delegated`, kind: 'delegated', at: timestamp(start?.['timestamp']) ?? timestamp(item.startedAt), tool: null, status: 'invocado', durationMs: null, dispatched: null });
    item.toolCallsJson.map(record).forEach((call, index) => {
      const tool = typeof call['tool'] === 'string' ? call['tool'] : 'Herramienta no informada';
      const status = typeof call['status'] === 'string' ? call['status'] : 'Estado no informado';
      const dispatched = typeof call['dispatched'] === 'boolean' ? call['dispatched'] : null;
      const started = timestamp(call['startedAt']), finished = timestamp(call['finishedAt']);
      const base = { ...common, tool, status, dispatched };
      const id = `${item.taskId}:tool:${typeof call['callId'] === 'string' ? call['callId'] : index}`;
      if (started) events.push({ ...base, id: `${id}:start`, kind: 'tool-start', at: started, status: dispatched === false ? 'No ejecutada' : 'Solicitud registrada', durationMs: null });
      if (finished || !started || !['running', 'pending'].includes(status)) events.push({ ...base, id: `${id}:end`, kind: finished ? 'tool-end' : 'tool-record', at: finished, durationMs: duration(call['durationMs']) });
    });
    const returned = snapshots.find((entry) => entry['phase'] === 'returned');
    if (returned || item.phase !== 'delegated') events.push({ ...common, id: `${item.taskId}:returned`, kind: 'returned', at: timestamp(returned?.['timestamp']) ?? timestamp(item.finishedAt), tool: null, status: item.status, durationMs: duration(item.durationMs), dispatched: null });
    const consumption = snapshots.filter((entry) => entry['phase'] === 'consumed');
    if (!consumption.length && item.phase === 'consumed') consumption.push({});
    consumption.forEach((consumed, index) => {
      const decision = record(consumed['consumption'])['decision'];
      events.push({ ...common, id: `${item.taskId}:consumed:${index}`, kind: 'consumed', at: timestamp(consumed['timestamp']), tool: null,
        status: typeof decision === 'string' ? decision : item.consumptionStatus ?? 'Consumo registrado sin decisión', durationMs: null, dispatched: null });
    });
  }
  return [...new Map(events.map((event) => [event.id, event])).values()].sort((a, b) => a.at === null ? b.at === null ? 0 : 1 : b.at === null ? -1 : Date.parse(a.at) - Date.parse(b.at));
}

export function traceExport(projectId: string, auditFilter: string, roleFilter: TraceRole, offset: number, events: readonly TraceEvent[], stale: boolean) {
  return { schemaVersion: 1, source: 'backend-persisted-telemetry', exportedAt: new Date().toISOString(), projectId,
    filters: { auditId: auditFilter || null, role: roleFilter }, scope: { kind: 'current-page', offset, delegationLimit: 20 }, stale,
    privacy: 'Metadata only: no tool inputs, outputs, source code, prompts or credentials.', events };
}
