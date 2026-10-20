import { useState } from 'react';
import type { FormEvent } from 'react';
import type { RegisterProject, Project } from '../types/contracts';
import { ErrorNotice } from './ui';
export function ProjectsPanel({
  register,
  pending,
  error,
  onRegistered,
}: {
  register: (value: RegisterProject) => Promise<Project>;
  pending: boolean;
  error: string | null;
  onRegistered: (id: string) => void;
}) {
  const [runner, setRunner] = useState<'jest' | 'pytest'>('jest');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const project = await register({
        name: String(form.get('name')).trim(),
        repoPath: String(form.get('repoPath')).trim(),
        defaultBranch: String(form.get('branch')).trim(),
        runnerType: runner,
      });
      onRegistered(project.id);
    } catch {
      /* Error is presented by the mutation hook. */
    }
  };
  return (
    <section className="panel registration">
      <div className="section-heading">
        <div>
          <span className="eyebrow">NUEVO WORKSPACE</span>
          <h2>Registrar proyecto</h2>
        </div>
      </div>
      <p>
        Indica un repositorio Git existente en el equipo del backend y dentro de sus raíces
        autorizadas.
      </p>
      <form onSubmit={(event) => void submit(event)} className="form-grid">
        <label>
          Nombre del proyecto
          <input name="name" required maxLength={4096} placeholder="Mi proyecto" />
        </label>
        <label className="wide">
          Ruta absoluta del repositorio
          <input name="repoPath" required placeholder="C:\repos\mi-proyecto" />
        </label>
        <label>
          Rama predeterminada
          <input name="branch" required defaultValue="Dev" />
        </label>
        <label>
          Runner
          <select
            value={runner}
            onChange={(event) => setRunner(event.target.value === 'pytest' ? 'pytest' : 'jest')}
          >
            <option value="jest">Jest · Node.js</option>
            <option value="pytest">pytest · Python</option>
          </select>
        </label>
        <ErrorNotice error={error} />
        <button className="primary" disabled={pending}>
          {pending ? 'Registrando…' : 'Registrar en la base de datos'}
        </button>
      </form>
    </section>
  );
}
