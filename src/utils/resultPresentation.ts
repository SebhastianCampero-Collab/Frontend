import type { AuditDetails, TestRun } from '../types/contracts';
import { auditLabel, record } from '../types/contracts';
import { explainError } from './errors';

const labels: Record<string, string> = {
  diagnosed: 'Análisis terminado', committed: 'Corrección verificada y guardada',
  rolled_back: 'Cambio revertido porque no superó la verificación', blocked: 'Operación bloqueada',
  failed: 'Operación no completada', pending: 'En espera', running: 'En curso', idle: 'Listo para comenzar',
  recovery_required: 'Se necesita revisión manual', inconclusive: 'Verificación incompleta',
};
export const statusLabel = (value: string): string => labels[value] ?? value.toUpperCase().replaceAll('_', ' ');
const runText = (run: TestRun | undefined): string => !run ? 'sin ejecución registrada'
  : `${run.summary.failed} ${run.summary.failed === 1 ? 'prueba fallida' : 'pruebas fallidas'} y ${run.summary.passed} ${run.summary.passed === 1 ? 'aprobada' : 'aprobadas'}${!run.complete || run.truncated ? ' (reporte incompleto)' : ''}`;

export function resultPresentation(details: AuditDetails) {
  const summary = details.audit.summaryJson, result = record(summary['result']);
  const state = result['status'] === 'recovery_required' ? 'recovery_required' : auditLabel(details);
  const baseline = details.testRuns.find((run) => run.runId === details.audit.baselineRunId);
  const candidate = details.testRuns.find((run) => run.runId === details.audit.candidateRunId);
  const verification = record(result['verification']);
  const verified = state === 'committed' && Boolean(details.audit.commitSha) && Boolean(details.audit.branchName?.startsWith('fix/')) &&
    baseline?.status === 'failed' && baseline.complete && !baseline.truncated && baseline.summary.failed > 0 &&
    baseline.summary.skipped === 0 && baseline.summary.todo === 0 &&
    candidate?.status === 'passed' && candidate.complete && !candidate.truncated && candidate.summary.failed === 0 &&
    candidate.summary.total > 0 && candidate.summary.passed === candidate.summary.total && candidate.cases.length === candidate.summary.total && candidate.cases.every((test) => test.status === 'passed') &&
    candidate.summary.skipped === 0 && candidate.summary.todo === 0 && baseline.runner === candidate.runner && baseline.configurationHash === candidate.configurationHash &&
    verification['verdict'] === 'ready_to_commit' && verification['verificationId'] === candidate.runId &&
    verification['baselineRunId'] === baseline.runId && verification['candidateRunId'] === candidate.runId;
  const task = record(summary['diagnostic']);
  const calls = Array.isArray(task['toolCallsExecuted']) ? task['toolCallsExecuted'] : [];
  const delegated = details.delegations.find((item) => item.role === 'diagnostic');
  const recordedChecks: unknown = record(calls.map(record).find((call) => call['tool'] === 'analyze_code')?.['input'])['checks'] ?? record(delegated?.scopedContextJson)['checks'];
  const checkNames: Record<string, string> = { syntax: 'sintaxis', semantic: 'tipos', lint: 'reglas de calidad' };
  const checks = Array.isArray(recordedChecks) ? recordedChecks.filter((check): check is string => typeof check === 'string' && check in checkNames) : [];
  const blocked = details.hookLogs.find((log) => log.decision === 'block');
  const failure = calls.map(record).find((call) => call['status'] !== 'completed' && typeof call['reason'] === 'string');
  const reason = blocked?.reason ?? failure?.['reason'] ?? task['reason'] ?? result['reason'] ?? summary['reason'];
  let text: string;
  if (state === 'diagnosed') text = `Se analizó ${details.audit.targetFile}. No se modificó el código ni se ejecutó una reparación.`;
  else if (verified) text = `La corrección fue verificada. Antes: ${runText(baseline)}. Después: ${runText(candidate)}. Se guardó un commit en la rama de reparación ${details.audit.branchName}. Esto no implica que se haya publicado en GitHub.`;
  else if (state === 'committed') text = 'El backend registra un commit guardado, pero esta auditoría no contiene toda la evidencia necesaria para resumir su verificación. Consulta las pruebas y los detalles antes de darla por confirmada.';
  else if (state === 'rolled_back') text = 'El cambio del intento se revirtió porque no se pudo aprobar su verificación. No se confirmó una corrección en esta operación.';
  else if (state === 'blocked') text = 'Un control impidió continuar con la operación. No se considera una corrección aprobada. Revisa el motivo indicado debajo.';
  else if (state === 'failed') text = 'La operación no pudo completarse. Este resultado no permite concluir que el código esté libre de errores ni que haya sido corregido.';
  else if (state === 'recovery_required') text = 'El backend solicita revisión manual del intento. No asumas que el commit, la auditoría o la reversión quedaron completamente sincronizados.';
  else text = 'Consulta el estado y la evidencia de esta operación. Todavía no se confirma una corrección verificada.';
  return { state, displayState: state === 'committed' && !verified ? 'inconclusive' : state, text,
    reason: state === 'diagnosed' ? null : typeof reason === 'string' ? explainError(reason) : null,
    checksText: state === 'diagnosed' ? checks.length ? `Comprobaciones ejecutadas: ${checks.map((check) => checkNames[check]).join(', ')}.${!checks.includes('semantic') ? ' No se revisaron errores de tipos.' : ''} El análisis estático no descarta todos los fallos de lógica.`
      : 'No se guardó la selección de comprobaciones en esta auditoría; no se afirma una revisión completa de todos los aspectos.' : null,
    baseline, candidate };
}
