import { useState } from 'react';
import type { FormEvent } from 'react';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { useHookGuardrails } from '../hooks/useHookGuardrails';
import { Badge, Empty, ErrorNotice, JsonDetails, Pagination } from './ui';
export function GuardrailsPanel({ projectId }: { projectId: string }) {
  const [offset, setOffset] = useState(0);
  const [auditId, setAuditId] = useState('');
  const [filterInput, setFilterInput] = useState('');
  const [decision, setDecision] = useState('all');
  const hooks = useHookGuardrails(projectId, auditId, offset);
  const [file, setFile] = useState('src/guardrail.ts');
  const [diff, setDiff] = useState('+export const verified = true;');
  const evaluate = (files: string[], patch: string) => {
    void hooks.evaluateGuardrail(files, patch).catch(() => {});
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    evaluate(
      file
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      diff,
    );
  };
  const logs =
    hooks.data?.logs.filter((log) => decision === 'all' || log.decision === decision) ?? [];
  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">02 / POLÍTICAS ACTIVAS</span>
            <h2>Hooks & Guardrails</h2>
          </div>
          <Badge value={hooks.data?.config.enabled ? 'allow' : 'unknown'} />
        </div>
        <p>
          Evaluaciones reales del backend. El simulador comprueba el parche sin modificar archivos.
        </p>
        <ErrorNotice error={hooks.error} />
        {hooks.data && (
          <div className="policy-chips">
            {Object.entries(hooks.data.config.rules).map(([rule, enabled]) => (
              <span key={rule} className={enabled ? 'policy enabled' : 'policy'}>
                {enabled ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
                {rule}
              </span>
            ))}
            <JsonDetails
              value={hooks.data.config}
              label="Configuración efectiva y archivos protegidos"
            />
          </div>
        )}
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Evaluar un guardrail en vivo</h2>
          <span className="eyebrow">PREFLIGHT / SIN MUTACIÓN</span>
        </div>
        <div className="demo-buttons">
          <button
            className="ghost"
            disabled={hooks.evaluation.pending}
            onClick={() => evaluate(['src/guardrail.ts'], '+export const verified = true;')}
          >
            Probar ALLOW
          </button>
          <button
            className="danger-button"
            disabled={hooks.evaluation.pending}
            onClick={() => evaluate(['.env'], '+DEMO_VALUE=blocked')}
          >
            Probar BLOCK · .env
          </button>
          <button
            className="ghost"
            disabled={hooks.evaluation.pending}
            onClick={() => evaluate(['src/guardrail.ts'], '+SECRET_KEY=demonstration')}
          >
            Probar bloqueo de secreto
          </button>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <label>
            Archivos (separados por coma)
            <input value={file} onChange={(event) => setFile(event.target.value)} required />
          </label>
          <label className="wide">
            Contenido del parche
            <textarea
              rows={3}
              value={diff}
              onChange={(event) => setDiff(event.target.value)}
              required
              spellCheck={false}
            />
          </label>
          <button className="primary" disabled={hooks.evaluation.pending}>
            {hooks.evaluation.pending ? 'Evaluando…' : 'Evaluar escenario'}
          </button>
        </form>
        <ErrorNotice error={hooks.evaluation.error} />
        {hooks.evaluation.data && (
          <div className="evaluation-result" role="status">
            <Badge value={hooks.evaluation.data.decision} />
            <span>
              Auditoría: <code>{hooks.evaluation.data.auditId}</code>
            </span>
            <p>
              {hooks.evaluation.data.hookLogs
                .filter((log) => log.decision === hooks.evaluation.data?.decision)
                .map((log) => log.reason)
                .join(' · ')}
            </p>
            <JsonDetails value={hooks.evaluation.data} />
          </div>
        )}
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Decisiones persistidas</h2>
          <button className="text-button" onClick={hooks.refresh}>
            Recargar logs
          </button>
        </div>
        <div className="filter-bar">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setAuditId(filterInput.trim());
              setOffset(0);
            }}
          >
            <label>
              Filtrar por auditoría
              <input
                value={filterInput}
                onChange={(event) => setFilterInput(event.target.value)}
                placeholder="UUID o vacío para todas"
              />
            </label>
            <button className="ghost">Filtrar</button>
          </form>
          <label>
            Decisión
            <select value={decision} onChange={(event) => setDecision(event.target.value)}>
              <option value="all">Todas en esta página</option>
              <option value="allow">ALLOW</option>
              <option value="block">BLOCK</option>
              <option value="warn">WARN</option>
            </select>
          </label>
        </div>
        {logs.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Decisión</th>
                  <th>Hook / evento</th>
                  <th>Motivo</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <Badge value={log.decision} />
                    </td>
                    <td>
                      <strong>{log.hookName}</strong>
                      <code>{log.event}</code>
                    </td>
                    <td>
                      {log.reason}
                      <JsonDetails value={log.metadataJson} label="Metadatos" />
                    </td>
                    <td>
                      <time>{new Date(log.createdAt).toLocaleString()}</time>
                      <code>{log.auditId}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            {hooks.loading ? 'Consultando decisiones…' : 'No hay decisiones con este filtro.'}
          </Empty>
        )}
        <Pagination offset={offset} count={hooks.data?.logs.length ?? 0} onChange={setOffset} />
      </section>
    </div>
  );
}
