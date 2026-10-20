import type { AuditDetails } from '../types/contracts';
import { auditLabel, record } from '../types/contracts';
import { Badge, JsonDetails } from './ui';
export function GitControlView({ details }: { details: AuditDetails }) {
  const result = record(details.audit.summaryJson['result']);
  const blocked = details.hookLogs.some((log) => log.decision === 'block');
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Decisión y control Git</h2>
        <Badge value={blocked ? 'blocked' : auditLabel(details)} />
      </div>
      <dl className="metadata">
        <div>
          <dt>Auditoría</dt>
          <dd>{details.audit.id}</dd>
        </div>
        <div>
          <dt>Rama aislada</dt>
          <dd>{details.audit.branchName ?? 'No creada'}</dd>
        </div>
        <div>
          <dt>Commit SHA</dt>
          <dd>{details.audit.commitSha ?? 'No se confirmó un commit'}</dd>
        </div>
        <div>
          <dt>Estado persistido</dt>
          <dd>{details.audit.status}</dd>
        </div>
      </dl>
      {details.audit.summaryJson['mode'] === 'diagnose' && (
        <p className="notice">
          Diagnóstico sin autorización de reparación: el estado persistido «blocked» no significa
          que el análisis haya fallado.
        </p>
      )}
      {blocked && (
        <p className="notice danger">
          Se registró un bloqueo de política. Revisa la evidencia de hooks; una reversión puede
          coexistir con ese bloqueo.
        </p>
      )}
      {typeof result['reason'] === 'string' && <p>{result['reason']}</p>}
      <JsonDetails value={details} label="Respuesta completa recuperable desde la BD" />
    </section>
  );
}
