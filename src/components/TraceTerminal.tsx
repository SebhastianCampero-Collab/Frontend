import { useEffect, useRef } from 'react';
import type { TraceEvent } from '../utils/traceTelemetry';
import { roleLabels } from '../utils/traceTelemetry';

const flow = (event: TraceEvent): string => event.kind === 'delegated' ? 'Coordinador → subagente: invocación'
  : event.kind === 'returned' ? 'Subagente → coordinador: respuesta'
  : event.kind === 'consumed' ? 'Coordinador: resultado consumido'
  : event.kind === 'tool-start' ? event.dispatched === false ? 'Solicitud rechazada sin ejecución' : 'Subagente → herramienta: solicitud'
  : event.kind === 'tool-end' ? event.dispatched === false ? 'Herramienta no ejecutada' : 'Herramienta → subagente: resultado'
  : event.dispatched === false ? 'Llamada no ejecutada' : 'Llamada registrada';

export function TraceTerminal({ events, loading, error }: { events: readonly TraceEvent[]; loading: boolean; error: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    if (container.current && follow.current) container.current.scrollTop = container.current.scrollHeight;
  }, [events]);
  return <div className="trace-terminal" role="region" aria-label="Terminal de telemetría de subagentes" tabIndex={0} ref={container} onScroll={() => {
    const node = container.current; if (node) follow.current = node.scrollHeight - node.clientHeight - node.scrollTop < 40;
  }}>
    <div className="trace-terminal-title"><span aria-hidden="true">● ● ●</span> DEVGUARDIAN / TELEMETRÍA PERSISTIDA</div>
    {events.length ? <table><caption>Eventos ordenados por la marca de tiempo del backend. Los eventos sin hora se muestran al final.</caption>
      <thead><tr><th>Hora</th><th>Rol</th><th>Comunicación / herramienta</th><th>Estado</th><th>Duración informada</th><th>Correlación</th></tr></thead>
      <tbody>{events.map((event) => <tr key={event.id} className={`trace-role-${event.role}`}>
        <td>{event.at ? <time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time> : 'Hora no informada'}</td>
        <td><span className="trace-role-label">{roleLabels[event.role]}</span></td>
        <td><span>{flow(event)}</span>{event.tool && <code>{event.tool}</code>}</td>
        <td><code>{event.status}</code></td>
        <td>{event.durationMs === null ? 'Sin medición informada' : `${event.durationMs.toLocaleString(undefined, { maximumFractionDigits: 2 })} ms`}</td>
        <td><span>Worker: <code>{event.workerId ?? 'No informado'}</code></span><span>Tarea: <code>{event.taskId}</code></span><span>Auditoría: <code>{event.auditId}</code></span></td>
      </tr>)}</tbody>
    </table> : <p className="terminal-empty">{loading ? 'Consultando eventos del backend…' : error ? 'No se pudo verificar la telemetría. Reintenta la consulta.' : 'No hay delegaciones registradas para este filtro en la página actual. Cambia de rol o consulta otra página. Las trazas aparecen cuando el backend ejecuta una operación que utiliza esos subagentes.'}</p>}
  </div>;
}
