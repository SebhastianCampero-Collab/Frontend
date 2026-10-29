import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { useAction } from '../hooks/useResource';
import type { RecloneResult } from '../types/contracts';
import { ErrorNotice } from './ui';

/** Restores an existing project workspace without creating a duplicate project row. */
export function WorkspaceRecovery({
  projectId,
  onRecovered,
  detail,
}: {
  projectId: string;
  onRecovered: () => void;
  detail?: string | null;
}) {
  const action = useAction<RecloneResult>();
  const [note, setNote] = useState<string | null>(null);
  const recover = async () => {
    setNote(null);
    try {
      const result = await action.execute(() => api.recloneProject(projectId));
      setNote(
        result.status === 'available'
          ? 'El workspace ya estaba disponible. Actualizando archivos, Git y auditorías…'
          : `Workspace restaurado en ${result.branch} (${result.headCommit.slice(0, 8)}). Actualizando archivos, Git y auditorías…`,
      );
      onRecovered();
    } catch {
      /* The action exposes the sanitized error. */
    }
  };
  return (
    <section className="panel workspace-recovery" aria-live="polite">
      <div className="section-heading">
        <div>
          <span className="eyebrow">WORKSPACE NO DISPONIBLE</span>
          <h2>El proyecto existe, pero su código no está en este servidor</h2>
        </div>
      </div>
      <p>
        {detail ??
          'El disco efímero se limpió después de una inactividad o un redespliegue.'}{' '}
        La base de datos conserva el proyecto, su rama y su URL de Git. Reclona el workspace para
        continuar sin crear un registro duplicado.
      </p>
      <ErrorNotice error={action.error} />
      {note && (
        <p className="notice" role="status">
          {note}
        </p>
      )}
      <button className="primary" disabled={action.pending} onClick={() => void recover()}>
        <RefreshCw size={16} className={action.pending ? 'spin' : undefined} />
        {action.pending ? 'Reclonando…' : 'Reclonar Workspace'}
      </button>
    </section>
  );
}
