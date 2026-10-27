export function RefreshButton({ resource, label, disabled = false }: {
  resource: { loading: boolean; refreshStatus: 'idle' | 'updating' | 'updated' | 'unchanged' | 'error'; updatedAt: number | null; error: string | null; refresh: () => void };
  label: string; disabled?: boolean;
}) {
  const text = resource.loading || resource.refreshStatus === 'updating' ? 'Actualizando...'
    : resource.error ? `Error: ${resource.error}`
    : resource.refreshStatus === 'unchanged' ? 'No hay registros nuevos'
    : resource.refreshStatus === 'updated' && resource.updatedAt ? `Actualizado a las ${new Date(resource.updatedAt).toLocaleTimeString()}` : label;
  return <button type="button" className="text-button" aria-label={label} aria-busy={resource.loading} disabled={disabled || resource.loading} onClick={() => void resource.refresh()}><span aria-live="polite">{text}</span></button>;
}
