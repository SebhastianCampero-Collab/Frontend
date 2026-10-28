import { useMemo, useState } from 'react';
import { useSubagents } from '../hooks/useSubagents';
import { ErrorNotice, Pagination } from './ui';
import { RefreshButton } from './RefreshButton';
import { TraceTerminal } from './TraceTerminal';
import { roleLabels, traceExport, traceTelemetry } from '../utils/traceTelemetry';
import type { TraceRole } from '../utils/traceTelemetry';

export function AgentMonitorView({ projectId }: { projectId: string }) {
  const [offset, setOffset] = useState(0);
  const [auditId, setAuditId] = useState('');
  const [input, setInput] = useState('');
  const [role, setRole] = useState<TraceRole>('all');
  const [exportError, setExportError] = useState<string | null>(null);
  const agents = useSubagents(projectId, auditId, offset);
  const events = useMemo(() => traceTelemetry(agents.data ?? []), [agents.data]);
  const visible = useMemo(() => events.filter((event) => role === 'all' || event.role === role), [events, role]);
  const download = () => {
    setExportError(null);
    if (!visible.length || agents.loading) return;
    try {
      const payload = traceExport(projectId, auditId, role, offset, visible, Boolean(agents.error));
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }));
      const anchor = document.createElement('a');
      try {
        anchor.href = url; anchor.download = `devguardian-trace-${projectId.replace(/[^a-z0-9_-]/giu, '_').slice(0, 64)}-${role}.json`;
        document.body.append(anchor); anchor.click();
      } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 0); }
    } catch { setExportError('No se pudo descargar la traza en este navegador. Vuelve a intentarlo.'); }
  };
  return <section className="panel">
    <div className="section-heading"><div><span className="eyebrow">MONITOREO / COMUNICACIÓN INTERNA</span><h2>Trazas de subagentes</h2></div><RefreshButton resource={agents} label="Recargar trazas" /></div>
    <p>Invocaciones, herramientas, respuestas y consumo del coordinador, según los registros del backend. Actualización cada 5 segundos con la pestaña visible.</p>
    <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); setAuditId(input.trim()); setOffset(0); setExportError(null); }}>
      <label>UUID de auditoría<input disabled={agents.loading} value={input} pattern="[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}" onChange={(event) => setInput(event.target.value)} placeholder="Vacío para todas las auditorías del proyecto" /></label>
      <button className="ghost" disabled={agents.loading}>Filtrar delegaciones</button>
    </form>
    <div className="trace-toolbar"><div role="group" aria-label="Rol del subagente">
      <button type="button" className="ghost" aria-pressed={role === 'all'} onClick={() => setRole('all')}>Todos</button>
      {(Object.keys(roleLabels) as Exclude<TraceRole, 'all'>[]).map((value) => <button key={value} type="button" className="ghost" aria-pressed={role === value} onClick={() => { setRole(value); setExportError(null); }}>{roleLabels[value]}</button>)}
    </div><button className="primary" type="button" disabled={agents.loading || !visible.length} onClick={download}>Exportar traza</button></div>
    <p role="status">{visible.length} líneas de telemetría · {agents.data?.length ?? 0} delegaciones cargadas. El filtro de rol y la exportación corresponden a la página actual.</p>
    <ErrorNotice error={agents.error} /><ErrorNotice error={exportError} />
    {agents.error && agents.data && <p className="notice">Se conservan los últimos datos recibidos. Una exportación se marcará como desactualizada mientras falle la conexión.</p>}
    <TraceTerminal events={visible} loading={agents.loading} error={agents.error} />
    <p><small>Las horas y duraciones proceden del backend. Una marca o medición ausente no se reemplaza por un tiempo inventado. La exportación contiene solo metadatos; excluye código, prompts y entradas/salidas completas de herramientas.</small></p>
    <Pagination offset={offset} count={agents.data?.length ?? 0} onChange={setOffset} disabled={agents.loading} />
  </section>;
}
