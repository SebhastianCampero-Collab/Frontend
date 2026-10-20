import { ErrorNotice } from './ui';

export function DemoPresets({
  prepare,
  pending,
  error,
}: {
  prepare: (mode: 'diagnose' | 'repair') => Promise<void>;
  pending: boolean;
  error: string | null;
}) {
  return (
    <div className="demo-presets">
      <p>
        Demo real: crea un checkout independiente en el backend y carga el formulario con su hash
        actual. Después pulsa Ejecutar.
      </p>
      <div className="segmented">
        <button
          type="button"
          disabled={pending}
          onClick={() => void prepare('diagnose').catch(() => {})}
        >
          Cargar Demo Diagnóstico Real
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void prepare('repair').catch(() => {})}
        >
          Cargar Demo Reparación / Subagentes
        </button>
      </div>
      {pending && <p role="status">Preparando repositorio y pruebas reales…</p>}
      <ErrorNotice error={error} />
    </div>
  );
}
