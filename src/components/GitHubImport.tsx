import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, message } from '../api/client';
import type { ImportReady, ImportEvent } from '../types/contracts';

export function GitHubImport({ onReady, onBusyChange }: { onReady: (result: ImportReady) => void; onBusyChange?: (busy: boolean) => void }) {
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => { onBusyChange?.(pending); return () => onBusyChange?.(false); }, [pending, onBusyChange]);
  const [events, setEvents] = useState<string[]>([]);
  const [result, setResult] = useState<ImportEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    setPending(true); setError(null); setResult(null); setEvents([]);
    try {
      await api.importProject(url.trim(), (update) => {
        if (abort.signal.aborted) return;
        setResult(update);
        if (update.event === 'progress') setEvents((items) => [...items, update.data.message]);
        if (update.event === 'ready') onReady(update.data);
      }, abort.signal);
    } catch (failure: unknown) {
      if (!abort.signal.aborted) setError(message(failure));
    } finally {
      if (controller.current === abort) { controller.current = null; setPending(false); }
    }
  };
  return <section className="panel" aria-labelledby="github-import-title">
    <span className="eyebrow">EMPIEZA AQUÍ</span>
    <h2 id="github-import-title">Importar desde GitHub</h2>
    <p>Pega el enlace de un repositorio público. Lo descargaremos en el servidor y comprobaremos si está listo para analizar.</p>
    <form onSubmit={(event) => void submit(event)} className="form-grid">
      <label className="wide">Enlace de GitHub
        <input type="url" required maxLength={300} placeholder="https://github.com/usuario/proyecto" value={url} disabled={pending} onChange={(event) => setUrl(event.target.value)} />
      </label>
      <button className="primary" disabled={pending}>{pending ? 'Preparando proyecto…' : 'Importar y preparar'}</button>
      {pending && <button type="button" onClick={() => { controller.current?.abort(); controller.current = null; setPending(false); setError('Importación cancelada. Revisa la lista de proyectos si la cancelaste durante el registro.'); }}>Cancelar</button>}
    </form>
    <div role="status" aria-live="polite" aria-busy={pending}>
      {pending && <p>Progreso por etapas reales; la descarga puede tardar hasta 90 segundos.</p>}
      <ol>{events.map((item, index) => <li key={index}>{item}</li>)}</ol>
      {result?.event === 'incompatible' && <div><h3>Falta preparar estas configuraciones</h3><ul>{result.data.missing.map((issue) => <li key={issue.code}><strong>{issue.path}</strong>: {issue.message}</li>)}</ul><p>Corrige el repositorio en GitHub y vuelve a importarlo.</p></div>}
      {result?.event === 'failed' && <p role="alert">{result.data.message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
    <small>JavaScript / TypeScript. No se instalan dependencias ni se ejecuta código durante la importación.</small>
  </section>;
}
