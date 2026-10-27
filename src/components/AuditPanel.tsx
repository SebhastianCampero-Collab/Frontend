import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Play, GitBranch, FileCode2, History, Fingerprint } from 'lucide-react';
import { api, message } from '../api/client';
import { useAuditRunner } from '../hooks/useAuditRunner';
import { useAuditPath } from '../hooks/useAuditPath';
import { useAction } from '../hooks/useResource';
import { RelativePathSchema, RepairSchema, auditLabel, record } from '../types/contracts';
import type { Project, Repair } from '../types/contracts';
import { CodeInspector } from './CodeInspector';
import { TestRunnerView } from './TestRunnerView';
import { GitControlView } from './GitControlView';
import { Badge, Empty, ErrorNotice, Pagination } from './ui';

export function AuditPanel({
  project,
  initialRepair,
  initialMode = 'diagnose',
  demoControls,
  initialPath,
}: {
  project: Project;
  initialRepair?: Repair;
  initialMode?: 'diagnose' | 'repair';
  demoControls?: ReactNode;
  initialPath?: string;
}) {
  const [offset, setOffset] = useState(0);
  const importedProject = project.repoPath.replaceAll('\\', '/').includes('/.devguardian-imports/');
  const audit = useAuditRunner(project.id, offset);
  const [mode, setMode] = useState<'diagnose' | 'repair'>(initialMode);
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
      if (mode === 'diagnose') await audit.run({ projectId: project.id, mode, path });
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
    } catch (error: unknown) {
      setValidation(message(error));
    }
  };
  return (
    <div className="audit-layout">
      <div className="audit-main">
        <section className="panel">
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
            <button
              className={mode === 'repair' ? 'active' : ''}
              disabled={importedProject || audit.pending}
              title={importedProject ? 'La reparación con pruebas requiere un sandbox para proyectos importados.' : undefined}
              onClick={() => setMode('repair')}
            >
              <GitBranch size={15} />
              Reparación verificada
            </button>
          </div>
          <form onSubmit={(event) => void submit(event)} className="form-grid">
            <label className="wide">
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
            </label>
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
              <button className="primary" disabled={audit.pending}>
                <Play size={15} />
                {audit.pending
                  ? 'Auditoría en curso…'
                  : mode === 'repair'
                    ? 'Ejecutar reparación'
                    : 'Ejecutar diagnóstico'}
              </button>
            </div>
          </form>
          {audit.pending && (
            <p role="status" className="notice">
              El backend está ejecutando la operación. El historial consulta la BD cada 5 segundos.
              Si se interrumpe la conexión, consulta el historial antes de repetirla.
            </p>
          )}
        </section>
        {audit.details && (
          <>
            <GitControlView details={audit.details} />
            <CodeInspector details={audit.details} />
            <TestRunnerView details={audit.details} />
          </>
        )}
      </div>
      <aside className="panel history-panel">
        <div className="section-heading">
          <h2>
            <History size={17} />
            Historial
          </h2>
          <button className="text-button" onClick={audit.history.refresh}>
            Recargar BD
          </button>
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
        <Pagination offset={offset} count={audit.history.data?.length ?? 0} onChange={setOffset} />
      </aside>
    </div>
  );
}
