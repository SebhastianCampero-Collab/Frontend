import { useState } from 'react';
import { useAdvancedOptions } from './AdvancedOptions';
export function TechnicalRequest({ payload }: { payload: unknown }) {
  const advanced = useAdvancedOptions();
  const [open, setOpen] = useState(false);
  if (!advanced) return null;
  return <div className="wide"><button type="button" className="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>Ver solicitud técnica</button>
    {open && <pre className="technical-request" aria-label="Solicitud técnica generada">{JSON.stringify(payload, null, 2)}</pre>}
  </div>;
}
