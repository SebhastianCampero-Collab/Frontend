import type { AuditDetails } from '../types/contracts';
import { DiagnosticSchema, record } from '../types/contracts';
import { z } from 'zod';
import { Badge, Empty, JsonDetails } from './ui';
export function CodeInspector({ details }: { details: AuditDetails }) {
  const summary = details.audit.summaryJson;
  const task = record(summary['diagnostic']);
  const diagnostic = record(record(summary['result'])['diagnostic']);
  const delegated = details.delegations.find((item) => item.role === 'diagnostic');
  const output = Object.keys(diagnostic).length ? diagnostic : Object.keys(record(task['output'])).length ? record(task['output']) : record(delegated?.outputJson);
  const parsed = z.array(DiagnosticSchema).safeParse(output['findings'] ?? summary['findings']);
  const diagnostics = parsed.success ? parsed.data : [];
  const status = typeof task['status'] === 'string' ? task['status'] : typeof diagnostic['analysisId'] === 'string' ? 'completed' : delegated?.status;
  const complete = parsed.success && output['truncated'] !== true &&
    (status === 'completed' || (status === undefined && summary['outcome'] === 'diagnosed'));
  const calls = Array.isArray(task['toolCallsExecuted']) ? task['toolCallsExecuted'] : delegated?.toolCallsJson ?? [];
  const failedCall = calls.map(record).find((call) => call['status'] !== 'completed' && typeof call['reason'] === 'string');
  const reason = failedCall?.['reason'] ?? task['reason'];
  const missingFile = reason === 'Path or parent directory does not exist.';
  const failed = status === 'failed' || status === 'rejected' || status === 'budget_exceeded' || (details.audit.status === 'failed' && !complete);
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Diagnóstico AST</h2>
        <span className="count">{complete ? `${diagnostics.length} hallazgos` : diagnostics.length ? 'Resultados parciales' : 'Análisis no completado'}</span>
      </div>
      {!complete && <p role={failed ? 'alert' : 'status'} className="notice">
        {missingFile ? `No se encontró el archivo «${details.audit.targetFile}» en este proyecto. Revisa la ruta e intenta de nuevo.`
          : failed ? 'El diagnóstico no pudo completarse. Esto no significa que el código esté libre de errores.'
          : output['truncated'] === true ? 'El diagnóstico tiene resultados parciales; no permite confirmar la ausencia de errores.'
          : 'Esta operación no tiene un diagnóstico completo disponible.'}
        {!missingFile && typeof reason === 'string' ? ` Detalle: ${reason}` : ''}
      </p>}
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
      ) : complete ? (
        <Empty>El diagnóstico se completó sin hallazgos en las comprobaciones ejecutadas.</Empty>
      ) : (
        <Empty>No hay resultados concluyentes para este archivo.</Empty>
      )}
      <JsonDetails value={output} label="Contexto y evidencia del diagnóstico" />
    </section>
  );
}
