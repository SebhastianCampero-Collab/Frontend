import type { AuditDetails } from '../types/contracts';
import { record } from '../types/contracts';
import { Badge, Empty, JsonDetails } from './ui';
export function TestRunnerView({ details }: { details: AuditDetails }) {
  const baseline = details.testRuns.find((run) => run.runId === details.audit.baselineRunId);
  const candidate = details.testRuns.find((run) => run.runId === details.audit.candidateRunId);
  const verification = record(record(details.audit.summaryJson['result'])['verification']);
  const comparisonCall = details.delegations
    .flatMap((item) => item.toolCallsJson)
    .map(record)
    .find((call) => call['tool'] === 'compare_test_runs');
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Baseline vs. candidato</h2>
        <span className="eyebrow">EVIDENCIA DE PRUEBAS</span>
      </div>
      <div className="comparison-grid">
        {(
          [
            ['Baseline', baseline],
            ['Candidato', candidate],
          ] as const
        ).map(([label, run]) => (
          <div className="run-card" key={label}>
            <h3>{label}</h3>
            {run ? (
              <>
                <Badge value={run.status} />
                <div className="run-numbers">
                  <strong>
                    {run.summary.passed}
                    <small>aprobadas</small>
                  </strong>
                  <strong>
                    {run.summary.failed}
                    <small>fallidas</small>
                  </strong>
                  <strong>
                    {run.summary.skipped + run.summary.todo}
                    <small>omitidas</small>
                  </strong>
                </div>
                <p>
                  {run.runner} · {run.durationMs.toFixed(0)} ms ·{' '}
                  {run.complete ? 'Reporte completo' : 'Reporte incompleto'}
                  {run.truncated ? ' · TRUNCADO' : ''}
                </p>
                <JsonDetails value={run} label="Casos, hashes e identidad del run" />
              </>
            ) : (
              <Empty>Esta operación no registró {label.toLowerCase()}.</Empty>
            )}
          </div>
        ))}
      </div>
      {typeof verification['verdict'] === 'string' && (
        <div className="verdict">
          <Badge value={verification['verdict']} />
          <span>{String(verification['reason'] ?? '')}</span>
        </div>
      )}
      {comparisonCall && (
        <JsonDetails value={comparisonCall['output']} label="Resultado real de compare_test_runs" />
      )}
    </section>
  );
}
