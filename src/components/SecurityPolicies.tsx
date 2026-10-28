import type { z } from 'zod';
import type { HookConfigSchema } from '../types/contracts';
import { securityPolicies } from '../utils/securityDashboard';
import { JsonDetails } from './ui';
export function SecurityPolicies({ config, stale }: { config: z.infer<typeof HookConfigSchema>; stale: boolean }) {
  const policies = securityPolicies(config);
  return <section className="panel" aria-labelledby="security-policies-title">
    <div className="section-heading"><h2 id="security-policies-title">Políticas de Seguridad Activas</h2><span className={`badge ${config.enabled ? 'good' : 'neutral'}`}>{policies.filter((policy) => policy.enabled).length} activas en la última configuración recibida</span></div>
    {stale && <p className="notice">No se pudo actualizar la configuración. Se muestran los últimos datos conocidos; no se confirma que sigan vigentes.</p>}
    {!config.enabled && <p className="notice danger">El backend informa que los hooks están deshabilitados. No se presentan como protecciones activas.</p>}
    <p>Varias políticas pueden pertenecer al mismo hook. Los estados reflejan la configuración recibida, incluidos sus valores predeterminados y sus desactivaciones explícitas.</p>
    <div className="security-policy-grid">{policies.map((policy) => <article key={policy.id} className="security-policy"><h3>{policy.name}</h3><span className={`badge ${policy.enabled ? 'good' : 'neutral'}`}>{policy.enabled ? 'Activa' : 'Desactivada'}</span><p>{policy.detail}</p></article>)}</div>
    <p><small>Fuente: configuración de hooks del backend. La restricción de directorios y los tiempos límite pertenecen a otros módulos y no se informan en este endpoint; no se inventan valores ni estados para ellos.</small></p>
    <JsonDetails value={config} label="Configuración efectiva del backend" />
  </section>;
}
