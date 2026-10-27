import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import { FileContextSchema, RelativePathSchema } from '../types/contracts';
import type { ProjectFiles } from '../types/contracts';
import { useAction } from '../hooks/useResource';
import { FileSelector } from './FileSelector';
import { TechnicalRequest } from './TechnicalRequest';
import { ErrorNotice } from './ui';

export function FileReader({ projectId, files, loading, error, refresh }: {
  projectId: string; files: ProjectFiles | null; loading: boolean; error: string | null; refresh: () => void;
}) {
  const [path, setPath] = useState('');
  const [start, setStart] = useState('1'), [end, setEnd] = useState('80');
  const action = useAction<ReturnType<typeof FileContextSchema.parse>>();
  const payload = { name: 'read_file_context', arguments: { projectId, path, startLine: Number(start), endLine: Number(end) } };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try { await action.execute(async () => {
      RelativePathSchema.parse(path);
      if (!files?.files.some((file) => file.path === path)) throw new Error('Selecciona un archivo del listado actualizado.');
      if (!Number.isSafeInteger(Number(start)) || !Number.isSafeInteger(Number(end)) || Number(start) < 1 || Number(end) < Number(start) || Number(end) > 1000000) throw new Error('Indica un rango válido de líneas, desde 1 y hasta 1000000.');
      const response = await api.callTool('read_file_context', { path, startLine: Number(start), endLine: Number(end) }, projectId);
      return FileContextSchema.parse(response.data);
    }); } catch { /* Error is rendered by the action. */ }
  };
  return <section className="panel"><h2>Consultar archivo</h2><p>Lee un fragmento del archivo sin modificarlo.</p>
    <form className="form-grid" onSubmit={(event) => void submit(event)}>
      <FileSelector label="Archivo para consultar" value={path} onChange={(value) => { setPath(value); action.reset(); }} files={files} loading={loading} error={error} refresh={refresh} disabled={action.pending} />
      <label>Desde la línea<input type="number" min={1} max={1000000} step={1} required value={start} disabled={action.pending} onChange={(event) => { setStart(event.target.value); action.reset(); }} /></label>
      <label>Hasta la línea<input type="number" min={Number(start) || 1} max={1000000} step={1} required value={end} disabled={action.pending} onChange={(event) => { setEnd(event.target.value); action.reset(); }} /></label>
      <TechnicalRequest payload={payload} />
      <ErrorNotice error={action.error} /><button className="primary" disabled={action.pending || loading || Boolean(error) || !path}>{action.pending ? 'Consultando…' : 'Consultar archivo'}</button>
    </form>
    {action.data && <div><p>{action.data.path} · líneas {action.data.startLine}–{action.data.endLine}</p>{action.data.truncated && <p className="notice">Contenido recortado por los límites del analizador. Consulta un rango menor.</p>}<pre className="file-content">{action.data.content}</pre></div>}
  </section>;
}
