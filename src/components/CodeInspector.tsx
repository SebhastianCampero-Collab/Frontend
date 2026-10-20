import type { AuditDetails } from '../types/contracts';
import { findings, record } from '../types/contracts';
import { Badge, Empty, JsonDetails } from './ui';
export function CodeInspector({ details }: { details: AuditDetails }) {
  const diagnostics = findings(details);
  const diagnostic = record(record(details.audit.summaryJson['result'])['diagnostic']);
  const delegated = details.delegations.find((item) => item.role === 'diagnostic');
  const output = Object.keys(diagnostic).length ? diagnostic : record(delegated?.outputJson);
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Diagnóstico AST</h2>
        <span className="count">{diagnostics.length} hallazgos</span>
      </div>
      {typeof output['rootCause'] === 'string' && (
        <p className="root-cause">{output['rootCause']}</p>
      )}
      {diagnostics.length ? (
        <div className="diagnostics">
          {diagnostics.map((item, index) => (
            <article key={`${item.path}-${item.code}-${index}`}>
              <Badge value={item.severity} />
              <code>
                {item.path}
                {item.range ? `:${item.range.start.line}:${item.range.start.column}` : ''}
              </code>
              <p>{item.message}</p>
              <small>
                {item.source} / {item.code}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <Empty>No hay hallazgos registrados para esta operación.</Empty>
      )}
      <JsonDetails value={output} label="Contexto y evidencia del diagnóstico" />
    </section>
  );
}
