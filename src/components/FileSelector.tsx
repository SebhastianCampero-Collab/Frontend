import type { ProjectFiles } from '../types/contracts';
import { ErrorNotice } from './ui';
export function FileSelector({ value, onChange, files, loading, error, refresh, disabled = false, sourceOnly = false, label = 'Archivo dentro del proyecto' }: {
  value: string; onChange: (path: string) => void; files: ProjectFiles | null; loading: boolean;
  error: string | null; refresh: () => void; disabled?: boolean; sourceOnly?: boolean; label?: string;
}) {
  const options = files?.files.filter((file) => !sourceOnly || file.analyzable) ?? [];
  return <div className="wide">
    <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled || loading || !options.length} required>
      <option value="">{loading ? 'Consultando archivos…' : 'Selecciona un archivo'}</option>
      {value && !options.some((file) => file.path === value) && <option value={value} disabled>Archivo no disponible: {value}</option>}
      {options.map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}
    </select></label>
    <button type="button" className="text-button" disabled={disabled || loading} onClick={refresh}>Actualizar archivos</button>
    <ErrorNotice error={error} />
    {!loading && !error && files && !options.length && <p role="status">No se encontraron archivos compatibles para esta operación.</p>}
    {files?.truncated && <p className="notice">Listado parcial por límites de tamaño, profundidad o acceso. Solo se muestran archivos verificados.</p>}
  </div>;
}
