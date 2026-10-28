import { useState } from 'react';
import { useSecurityDashboard, SECURITY_PAGE_SIZE } from '../hooks/useSecurityDashboard';
import { interceptedFile } from '../utils/securityDashboard';
import { explainError } from '../utils/errors';
import { SecurityPolicies } from './SecurityPolicies';
import { RefreshButton } from './RefreshButton';
import { Empty, ErrorNotice, JsonDetails, Pagination } from './ui';

export function GuardrailsPanel({ projectId }: { projectId: string }) {
  const [offset, setOffset] = useState(0);
  const [auditId, setAuditId] = useState('');
  const [input, setInput] = useState('');
  const security = useSecurityDashboard(projectId, auditId, offset);
  const logs = [...new Map((security.data?.logs ?? []).filter((log) => log.decision === 'block').map((log) => [log.id, log])).values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <div className="stack">
    <section className="panel"><span className="eyebrow">SEGURIDAD / AUDITORÍA DEL PROYECTO</span><h2>Dashboard de Auditoría de Seguridad</h2>
      <p>Consulta las políticas configuradas y las operaciones que el backend bloqueó. Este panel no envía parches ni ejecuta comprobaciones manuales.</p>
      <ErrorNotice error={security.error} />
    </section>
    {security.data ? <SecurityPolicies config={security.data.config} stale={Boolean(security.error)} /> : <Empty>{security.loading ? 'Consultando políticas del backend…' : 'No se pudo verificar la configuración de seguridad.'}</Empty>}
    <section className="panel" aria-labelledby="interceptions-title">
      <div className="section-heading"><h2 id="interceptions-title">Registro de Intercepciones</h2><RefreshButton resource={security} label="Actualizar intercepciones" /></div>
      <p role="status">{security.error ? 'Conexión interrumpida: el registro puede estar desactualizado.' : security.loading ? 'Actualizando el registro desde el backend…' : 'Actualización automática cada 5 segundos mientras esta pestaña esté visible.'}</p>
      <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); setAuditId(input.trim()); setOffset(0); }}>
        <label>Filtrar por auditoría<input value={input} disabled={security.loading} onChange={(event) => setInput(event.target.value)} pattern="[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}" placeholder="UUID o vacío para todo el proyecto" /></label>
        <button className="ghost" disabled={security.loading}>Filtrar intercepciones</button>
      </form>
      <div className="security-console" role="region" aria-label="Consola de intercepciones bloqueadas" tabIndex={0}>
        {logs.length ? <table><caption>Bloqueos registrados por el backend, ordenados del más reciente al más antiguo.</caption><thead><tr><th>Fecha y hora</th><th>Archivo involucrado</th><th>Motivo del bloqueo</th><th>Evidencia</th></tr></thead><tbody>
          {logs.map((log) => {
            const explicit = interceptedFile(log);
            const target = security.targets.data?.[log.auditId];
            return <tr key={log.id}><td><time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time></td>
              <td><code>{explicit ?? (target ? `Objetivo de la auditoría: ${target}` : security.targets.loading ? 'Consultando archivo…' : 'Archivo no informado por el backend')}</code></td>
              <td><span className="badge bad">Bloqueado</span><p>{explainError(log.reason)}</p></td>
              <td><span>{log.hookName} · {log.event}</span><code>{log.auditId}</code><JsonDetails value={log.metadataJson} label="Metadatos de la intercepción" /></td>
            </tr>;
          })}
        </tbody></table> : <Empty>{security.loading ? 'Consultando intercepciones…' : security.error ? 'No se pudo verificar si hay bloqueos. Reintenta la consulta.' : 'No hay bloqueos en esta página de registros. Esto no implica que el proyecto esté libre de riesgos.'}</Empty>}
      </div>
      <p><small>Cada página consulta hasta {SECURITY_PAGE_SIZE} bloqueos del backend. El archivo objetivo de una auditoría no identifica necesariamente todos los archivos afectados.</small></p>
      <Pagination offset={offset} count={security.data?.logs.length ?? 0} onChange={setOffset} disabled={security.loading} />
    </section>
  </div>;
}
