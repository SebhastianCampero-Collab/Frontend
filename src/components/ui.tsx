import type { ReactNode } from 'react';
import { useAdvancedOptions } from './AdvancedOptions';
import { statusLabel } from '../utils/resultPresentation';
import { explainError } from '../utils/errors';
export function Badge({ value }: { value: string }) {
  const tone = [
    'allow',
    'allowed',
    'passed',
    'committed',
    'completed',
    'success',
    'ready_to_commit',
    'diagnosed',
    'tool_completed',
  ].includes(value)
    ? 'good'
    : ['block', 'blocked', 'failed', 'regression', 'rejected', 'error'].includes(value)
      ? 'bad'
      : 'neutral';
  return <span className={`badge ${tone}`} data-status={value}>{statusLabel(value)}</span>;
}
export function ErrorNotice({ error }: { error: string | null | undefined }) {
  return error ? (
    <div className="notice danger" role="alert">
      {explainError(error)}
    </div>
  ) : null;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function JsonDetails({
  value,
  label = 'Ver evidencia JSON',
}: {
  value: unknown;
  label?: string;
}) {
  const advanced = useAdvancedOptions();
  if (!advanced) return null;
  return (
    <details className="json-details">
      <summary>{label}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
export function Pagination({
  offset,
  count,
  onChange,
  disabled = false,
}: {
  offset: number;
  count: number;
  onChange: (offset: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="pagination">
      <span>
        Registros {count ? offset + 1 : 0}–{offset + count}
      </span>
      <button
        className="ghost"
        disabled={disabled || offset === 0}
        onClick={() => onChange(Math.max(0, offset - 20))}
      >
        Anterior
      </button>
      <button className="ghost" disabled={disabled || count < 20} onClick={() => onChange(offset + 20)}>
        Siguiente
      </button>
    </div>
  );
}
