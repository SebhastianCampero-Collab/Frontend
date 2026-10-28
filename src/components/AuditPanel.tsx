import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Play, GitBranch, FileCode2, History, Fingerprint } from 'lucide-react';
import { api, message } from '../api/client';
import { useAuditRunner } from '../hooks/useAuditRunner';
import { useAuditPath } from '../hooks/useAuditPath';
import { useAction } from '../hooks/useResource';
import { RelativePathSchema, RepairSchema, auditLabel, record } from '../types/contracts';
import type { Project, Repair } from '../types/contracts';
import type { Check } from '../types/contracts';
import { useProjectFiles } from '../hooks/useProjectFiles';
import { FileSelector } from './FileSelector';
import { FileReader } from './FileReader';
import { TechnicalRequest } from './TechnicalRequest';
import { RepairProgress } from './RepairProgress';
import { RefreshButton } from './RefreshButton';
import { CodeInspector } from './CodeInspector';
import { ResultResponse } from './ResultResponse';
import { useAdvancedOptions } from './AdvancedOptions';
import { useServerHealth } from '../hooks/useServerHealth';
import { Badge, Empty, ErrorNotice, Pagination } from './ui';

export function AuditPanel({
  project,
  initialRepair,
  initialMode = 'diagnose',
  demoControls,
  initialPath,
  view = 'all',
  onComplete,
  onBusyChange,
}: {
  project: Project;
  initialRepair?: Repair;
  initialMode?: 'diagnose' | 'repair';
  demoControls?: ReactNode;
  initialPath?: string;
  view?: 'review' | 'results' | 'all';
  onComplete?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [offset, setOffset] = useState(0);
  const importedProject = project.repoPath.replaceAll('\\', '/').includes('/.devguardian-imports/');
  const health = useServerHealth();
  const repairUnavailable = (importedProject || health.data?.capabilities?.requiresIsolation === true) && health.data?.capabilities?.isolatedTests !== true;
  const audit = useAuditRunner(project.id, offset, view === 'results');
  useEffect(() => { onBusyChange?.(audit.pending); return () => onBusyChange?.(false); }, [audit.pending, onBusyChange]);
  const advanced = useAdvancedOptions();
  const files = useProjectFiles(project.id, view !== 'results');
  const [checks, setChecks] = useState<Check[]>(['syntax', 'semantic', 'lint']);
  const [selectedMode, setMode] = useState<'diagnose' | 'repair'>(initialMode);
  const mode = advanced && !repairUnavailable ? selectedMode : 'diagnose';
  const previousFile = audit.history.data?.find((item) => auditLabel(item) === 'diagnosed' || item.audit.status === 'committed')?.audit.targetFile;
  const { path, setPath } = useAuditPath(project.id,
    initialRepair?.path ?? initialPath ?? previousFile ?? (project.name.startsWith('Demo Render ') ? 'src/target-bug.ts' : ''),
  );
  const [hash, setHash] = useState(path === initialRepair?.path ? initialRepair.expectedFileHashes[path] ?? '' : '');
  const [validation, setValidation] = useState<string | null>(null);
  const context = useAction<{ path: string; fileHash: string }>();
  const hashValue = hash || (context.data?.path === path ? context.data.fileHash : '');
  const getHash = async () => {
    try {
      await context.execute(async () => {
        RelativePathSchema.parse(path);
        const result = await api.callTool('read_file_context', { path }, project.id);
        const source = record(result.data);
        if (typeof source['fileHash'] !== 'string' || !/^[a-f0-9]{64}$/.test(source['fileHash']))
          throw new Error('El servidor no devolvió un SHA-256 válido.');
        return { path, fileHash: source['fileHash'] };
      });
      setHash('');
    } catch {
      /* The action exposes the error. */
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidation(null);
    const form = new FormData(event.currentTarget);
    try {
      RelativePathSchema.parse(path);
      if (mode === 'diagnose') {
        if (!checks.length) throw new Error('Selecciona al menos una comprobación.');
        if (!advanced && !files.data?.files.some((file) => file.path === path && file.analyzable)) throw new Error('Selecciona un archivo disponible en el listado del proyecto.');
        await audit.run({ projectId: project.id, mode, path, checks });
      }
      else {
        const repair = RepairSchema.parse({
          path,
          slug: String(form.get('slug')),
          message: String(form.get('message')),
          unifiedDiff: String(form.get('diff')),
          expectedFileHashes: { [path]: hashValue },
          runner: project.runnerType,
          targets: String(form.get('targets'))
            .split(/[\n,]+/)
            .map((item) => item.trim())
            .filter(Boolean),
        });
        await audit.run({ projectId: project.id, mode, repair });
      }
      if (mounted.current) onComplete?.();
    } catch (error: unknown) {
      setValidation(message(error));
    }
  };
  return (
    <div className="audit-layout" style={view === 'review' ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined}>
      <div className="audit-main">
        {view !== 'results' && <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">01 / EJECUCIÓN</span>
              <h2>Auditar un archivo</h2>
            </div>
            <Badge value={audit.phase} />
          </div>
          {importedProject && <p>Analizarás un archivo de tu repositorio importado. El diagnóstico no modifica el código ni publica cambios en GitHub.</p>}
          {!importedProject && demoControls && (
            <fieldset
              disabled={audit.pending || audit.selecting}
              style={{ border: 0, padding: 0, minWidth: 0 }}
            >
              {demoControls}
            </fieldset>
          )}
          <div className="segmented">
            <button
              className={mode === 'diagnose' ? 'active' : ''}
              onClick={() => setMode('diagnose')}
              disabled={audit.pending}
            >
              <FileCode2 size={15} />
              Solo diagnóstico
            </button>
            {advanced && <button
              className={mode === 'repair' ? 'active' : ''}
              disabled={repairUnavailable || audit.pending}
              title={repairUnavailable ? 'La reparación con pruebas requiere un sandbox operativo para proyectos importados.' : undefined}
              onClick={() => setMode('repair')}
            >
              <GitBranch size={15} />
              Reparación verificada
            </button>}
          </div>
          <form onSubmit={(event) => void submit(event)}><fieldset className="form-grid action-fields" disabled={audit.pending || audit.selecting}>
            <FileSelector label={advanced ? 'Archivo del proyecto' : 'Archivo dentro del proyecto'} value={path} onChange={(value) => { setPath(value); setHash(''); }} files={files.data} loading={files.loading} error={files.error} refresh={files.refresh} disabled={audit.pending} sourceOnly />
            {advanced && <label className="wide">
              Archivo dentro del proyecto
              <input
                value={path}
                placeholder="Ejemplo: src/calculator.ts"
                onChange={(event) => {
                  setPath(event.target.value);
                  setHash('');
                }}
                required
                disabled={audit.pending}
              />
            </label>}
            {mode === 'diagnose' && <fieldset className="wide review-checks"><legend>¿Qué quieres revisar?</legend>
              {([['syntax', 'Errores de sintaxis'], ['semantic', 'Errores de tipos'], ['lint', 'Reglas de calidad']] as const).map(([check, label]) => <label key={check}><input type="checkbox" checked={checks.includes(check)} disabled={audit.pending} onChange={(event) => setChecks((current) => event.target.checked ? [...current, check] : current.filter((value) => value !== check))} />{label}</label>)}
              {!checks.length && <p role="status">Selecciona al menos una comprobación para continuar.</p>}
            </fieldset>}
            {mode === 'diagnose' && <TechnicalRequest payload={{ projectId: project.id, mode, path, checks }} />}
            {mode === 'repair' && (
              <>
                <p className="notice wide">
                  Este flujo aplica tu parche explícito: baseline → rama fix/… → verificación →
                  commit o rollback. Usa un checkout limpio y dedicado.
                </p>
                <label className="wide">
                  SHA-256 esperado
                  <div className="input-action">
                    <input
                      value={hashValue}
                      onChange={(event) => setHash(event.target.value)}
                      required
                      pattern="[a-f0-9]{64}"
                      aria-label="SHA-256 esperado"
                      disabled={audit.pending}
                    />
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => void getHash()}
                      disabled={context.pending || audit.pending}
                    >
                      <Fingerprint size={15} />
                      Obtener hash actual
                    </button>
                  </div>
                </label>
                <ErrorNotice error={context.error} />
                <label>
                  Nombre de rama fix/…
                  <input
                    name="slug"
                    defaultValue={initialRepair?.slug ?? 'dashboard-repair'}
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    disabled={audit.pending}
                  />
                </label>
                <label>
                  Mensaje del commit
                  <input
                    name="message"
                    defaultValue={
                      initialRepair?.message ?? 'fix: reparación verificada desde dashboard'
                    }
                    required
                    disabled={audit.pending}
                  />
                </label>
                <label className="wide">
                  Targets de {project.runnerType} (separados por coma)
                  <input
                    name="targets"
                    defaultValue={initialRepair?.targets.join(', ') ?? ''}
                    required
                    placeholder={
                      project.runnerType === 'jest' ? 'tests/bug.test.cjs' : 'tests/test_bug.py'
                    }
                    disabled={audit.pending}
                  />
                </label>
                <label className="wide">
                  Parche unified diff
                  <textarea
                    name="diff"
                    defaultValue={initialRepair?.unifiedDiff ?? ''}
                    rows={8}
                    spellCheck={false}
                    required
                    placeholder="diff --git a/src/server/contracts.ts b/src/server/contracts.ts"
                    disabled={audit.pending}
                  />
                </label>
              </>
            )}
            <ErrorNotice error={validation ?? audit.error} />
            <div className="form-footer wide">
              <span>
                Runner del proyecto: <strong>{project.runnerType}</strong>
              </span>
              <button className="primary" disabled={audit.pending || (mode === 'diagnose' && (!checks.length || (!advanced && (files.loading || Boolean(files.error) || !files.data?.files.some((file) => file.path === path && file.analyzable)))))}>
                <Play size={15} />
                {audit.pending
                  ? 'Auditoría en curso…'
                  : mode === 'repair'
                    ? 'Ejecutar reparación'
                    : 'Revisar código'}
              </button>
            </div>
          </fieldset></form>
          {audit.pending && (mode === 'repair' || audit.repairActive) && <RepairProgress details={audit.progress} error={audit.progressError} recovering={audit.awaitingConfirmation} resource={audit.progressResource} />}
          {audit.pending && (
            <p role="status" className="notice">
              La solicitud está pendiente de confirmación. El historial consulta los registros del backend.
              Si se interrumpe la conexión, comprueba el estado antes de repetir la operación.
            </p>
          )}
        </section>}
        {view !== 'results' && <FileReader projectId={project.id} files={files.data} loading={files.loading} error={files.error} refresh={files.refresh} disabled={audit.pending} />}
        {view !== 'review' && audit.details && (
          <>
            <ResultResponse key={audit.details.audit.id} details={audit.details} />
            <CodeInspector details={audit.details} />
          </>
        )}
        {view === 'results' && !audit.details && <Empty>{audit.history.error ? 'No se pudieron recuperar los resultados. Reintenta desde el historial.' : audit.history.loading ? 'Consultando resultados…' : 'Todavía no hay resultados. Ve a Revisar código para iniciar un diagnóstico.'}</Empty>}
      </div>
      {view !== 'review' && <aside className="panel history-panel">
        <div className="section-heading">
          <h2>
            <History size={17} />
            Historial
          </h2>
          <RefreshButton resource={audit.history} label="Recargar BD" disabled={audit.pending || audit.selecting} />
        </div>
        <p>Sesiones persistidas · se recuperan al recargar.</p>
        <ErrorNotice error={audit.history.error} />
        {audit.history.loading && !audit.history.data && (
          <p role="status">Consultando registros…</p>
        )}
        {audit.history.data?.length ? (
          <div className="history-list">
            {audit.history.data.map((item) => (
              <button
                key={item.audit.id}
                className={audit.details?.audit.id === item.audit.id ? 'selected' : ''}
                disabled={audit.selecting || audit.pending}
                onClick={() => void audit.select(item.audit.id).catch(() => {})}
              >
                <div>
                  <Badge value={auditLabel(item)} />
                  <time>{new Date(item.audit.startedAt).toLocaleString()}</time>
                </div>
                <strong>{item.audit.targetFile}</strong>
                <code>{item.audit.id.slice(0, 8)}</code>
              </button>
            ))}
          </div>
        ) : (
          !audit.history.loading && (
            <Empty>Aún no hay auditorías de este proyecto. Ejecuta el primer diagnóstico.</Empty>
          )
        )}
        <Pagination offset={offset} count={audit.history.data?.length ?? 0} onChange={setOffset} disabled={audit.history.loading || audit.pending || audit.selecting} />
      </aside>}
    </div>
  );
}
