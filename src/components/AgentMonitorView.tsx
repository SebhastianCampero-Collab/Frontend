import { useState } from 'react';
import { ArrowDown, Workflow } from 'lucide-react';
import { useSubagents } from '../hooks/useSubagents';
import { record } from '../types/contracts';
import { Badge, Empty, ErrorNotice, JsonDetails, Pagination } from './ui';
import { RefreshButton } from './RefreshButton';
export function AgentMonitorView({ projectId }: { projectId: string }) {
  const [offset, setOffset] = useState(0);
  const [auditId, setAuditId] = useState('');
  const [input, setInput] = useState('');
  const agents = useSubagents(projectId, auditId, offset);
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">03 / DELEGACIÓN DETERMINISTA</span>
          <h2>Subagentes y consumo de resultados</h2>
        </div>
        <RefreshButton resource={agents} label="Recargar trazas" />
      </div>
      <p>
        Contexto delegado → worker → herramientas → dictamen → resultado consumido. Las trazas
        provienen de la base de datos.
      </p>
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          setAuditId(input.trim());
          setOffset(0);
        }}
      >
        <label>
          UUID de auditoría
          <input
            disabled={agents.loading}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Vacío para todas las auditorías del proyecto"
          />
        </label>
        <button className="ghost" disabled={agents.loading}>Filtrar delegaciones</button>
      </form>
      <ErrorNotice error={agents.error} />
      {agents.data?.length ? (
        <ol className="timeline">
          {agents.data.map((item) => (
            <li key={item.taskId}>
              <span className="timeline-icon">
                <Workflow size={17} />
              </span>
              <div className="trace">
                <div className="section-heading">
                  <h3>{item.role}</h3>
                  <Badge value={item.status} />
                </div>
                <p>{item.objective}</p>
                <dl className="metadata">
                  <div>
                    <dt>Worker ID</dt>
                    <dd>{item.subagentId ?? 'Aún no retornó'}</dd>
                  </div>
                  <div>
                    <dt>Task ID / auditoría</dt>
                    <dd>
                      {item.taskId}
                      <br />
                      {item.parentSessionId}
                    </dd>
                  </div>
                  <div>
                    <dt>Duración</dt>
                    <dd>{item.durationMs.toFixed(0)} ms</dd>
                  </div>
                </dl>
                <div className="trace-phases">
                  <span>Delegado</span>
                  <ArrowDown size={13} />
                  <span>
                    {item.phase === 'delegated' ? 'Esperando retorno' : 'Resultado retornado'}
                  </span>
                  <ArrowDown size={13} />
                  <strong>{item.consumptionStatus ?? 'Sin consumo registrado'}</strong>
                </div>
                <div className="tool-pills">
                  {item.toolCallsJson.map((call, index) => {
                    const value = record(call);
                    return (
                      <span key={index}>
                        {String(value['tool'] ?? 'herramienta')} · {String(value['status'] ?? '')}
                      </span>
                    );
                  })}
                </div>
                <JsonDetails
                  value={item.toolCallsJson}
                  label="Herramientas y resultados de cada llamada"
                />
                <JsonDetails value={item.outputJson} label="Dictamen del subagente" />
                <JsonDetails
                  value={{ context: item.scopedContextJson, snapshots: item.snapshots }}
                  label="Contexto y línea de tiempo persistida"
                />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <Empty>
          {agents.loading
            ? 'Consultando delegaciones…'
            : 'No hay delegaciones registradas. Ejecuta un diagnóstico o una reparación para generar trazas reales.'}
        </Empty>
      )}
      <Pagination offset={offset} count={agents.data?.length ?? 0} onChange={setOffset} disabled={agents.loading} />
    </section>
  );
}
