import { useId, useState } from 'react';
import type { AuditDetails } from '../types/contracts';
import { resultPresentation } from '../utils/resultPresentation';
import { useAdvancedOptions } from './AdvancedOptions';
import { Badge } from './ui';
import { GitControlView } from './GitControlView';
import { TestRunnerView } from './TestRunnerView';

export function ResultResponse({ details }: { details: AuditDetails }) {
  const advanced = useAdvancedOptions();
  const [panel, setPanel] = useState<'tests' | 'changes' | 'technical' | null>(null);
  const id = useId();
  const result = resultPresentation(details);
  const toggle = (value: NonNullable<typeof panel>) => setPanel((current) => current === value ? null : value);
  return <section className="panel result-response" aria-labelledby={`${id}-title`}>
    <div className="section-heading"><h2 id={`${id}-title`}>Resultado de la revisión</h2><Badge value={result.displayState} /></div>
    <p className="result-summary">{result.text}</p>
    {result.checksText && <p>{result.checksText}</p>}
    {result.reason && <p className="notice"><strong>Motivo registrado:</strong> {result.reason}</p>}
    <div className="workspace-actions" aria-label="Consultar evidencia de la operación">
      <button className="ghost" aria-expanded={panel === 'tests'} aria-controls={`${id}-tests`} onClick={() => toggle('tests')}>Consultar pruebas</button>
      <button className="ghost" aria-expanded={panel === 'changes'} aria-controls={`${id}-changes`} onClick={() => toggle('changes')}>Ver cambios realizados</button>
      <button className="ghost" disabled={!advanced} title={!advanced ? 'Activa Opciones avanzadas para ver los detalles técnicos.' : undefined} aria-expanded={advanced && panel === 'technical'} aria-controls={`${id}-technical`} onClick={() => toggle('technical')}>Detalles técnicos</button>
    </div>
    {!advanced && <p><small>Activa Opciones avanzadas si necesitas consultar hashes, estados internos o JSON.</small></p>}
    {panel === 'tests' && <div id={`${id}-tests`} className="result-evidence">{details.testRuns.length ? <TestRunnerView details={details} /> : <p>Esta operación no registró pruebas. Un diagnóstico estático no equivale a ejecutar pruebas antes y después de una reparación.</p>}</div>}
    {panel === 'changes' && <div id={`${id}-changes`} className="result-evidence"><h3>Cambios de esta operación</h3>
      <p>Archivo objetivo: <strong>{details.audit.targetFile}</strong>.</p>
      {result.state === 'diagnosed' ? <p>Solo se realizó el análisis. No se aplicó ningún parche.</p>
        : result.state === 'rolled_back' ? <p>Se registró una reversión del intento. No se presenta un parche como corrección confirmada.</p>
        : details.audit.commitSha ? <p>Hay un commit registrado{details.audit.branchName ? ` en ${details.audit.branchName}` : ''}. {advanced && <code>{details.audit.commitSha}</code>} No se guardó un diff completo para mostrar líneas modificadas; no se reconstruyen cambios a partir del checkout actual.</p>
        : <p>No hay un commit confirmado en esta auditoría. Consulta el motivo y el estado antes de asumir qué cambios quedaron aplicados.</p>}
    </div>}
    {advanced && panel === 'technical' && <div id={`${id}-technical`} className="result-evidence"><GitControlView details={details} /></div>}
  </section>;
}
