import type { AuditDetails } from '../types/contracts';
import { explainError } from '../utils/errors';
import type { ComponentProps } from 'react';
import { RefreshButton } from './RefreshButton';

const labels: Record<string, string> = {
  'pre:delegate': 'Delegación a un subagente iniciada', 'post:delegate': 'Resultado de una delegación registrado',
  'pre:analyze': 'Comprobación previa al análisis', 'pre:apply_patch': 'Comprobación previa a aplicar el parche',
  'pre:run_tests': 'Preparación de la ejecución de pruebas', 'post:test_run': 'Ejecución de pruebas registrada',
  'pre:git_commit': 'Comprobación previa al commit', 'post:commit': 'Commit registrado',
};
export function RepairProgress({ details, error, recovering, resource }: { details: AuditDetails | null; error: string | null; recovering: boolean; resource?: ComponentProps<typeof RefreshButton>['resource'] }) {
  const events = details?.hookLogs.filter((event) => labels[event.event]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) ?? [];
  const latest = events.at(-1);
  return <section className="notice" aria-label="Progreso confirmado de la reparación" aria-live="polite">
    <strong>{!details ? 'Esperando confirmación del backend' : !['pending', 'running'].includes(details.audit.status) ? 'Resultado confirmado por el backend' : recovering ? 'Comprobando el estado de la reparación' : 'Seguimiento de la reparación'}</strong>
    <p>{latest ? `Último paso confirmado por el backend: ${labels[latest.event]}.`
      : details ? `Estado emitido por el backend: ${details.audit.status}. Todavía no hay un paso detallado registrado.`
      : 'Esperando el primer registro del backend. Todavía no se confirma ningún paso de la reparación.'}</p>
    {latest && <small>Registrado a las {new Date(latest.createdAt).toLocaleTimeString()}. Este evento no permite afirmar que el paso siguiente ya terminó.</small>}
    {error && <p>Última consulta: {explainError(error)} Se volverá a consultar el mismo intento, sin reenviar la reparación.</p>}
    <p>No repitas la operación mientras el servidor no confirme su resultado.</p>
    {resource && <RefreshButton resource={resource} label="Consultar estado del intento" />}
  </section>;
}
