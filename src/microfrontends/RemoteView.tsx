import { useEffect, useRef, useState } from 'react';
import type { RemoteHandle, RemoteName, RemoteProps } from './contracts';
import { loadRemote } from './loader';
export function RemoteView({ name, options }: { name: RemoteName; options: RemoteProps }) {
  const container = useRef<HTMLDivElement>(null), handle = useRef<RemoteHandle | null>(null), latest = useRef(options);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => { latest.current = options; handle.current?.update(options); }, [options]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    void loadRemote(name).then(remote => {
      if (cancelled || !container.current) return;
      handle.current = remote.mount(container.current, latest.current); setLoading(false);
    }).catch((failure: unknown) => { if (!cancelled) { setLoading(false); setError(failure instanceof Error ? failure.message : 'No se pudo abrir el módulo.'); } });
    return () => { cancelled = true; handle.current?.unmount(); handle.current = null; };
  }, [name, retry]);
  return <><div role="status">{loading ? 'Abriendo módulo…' : ''}</div>{error && <section role="alert" className="panel"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Reintentar módulo</button></section>}<div ref={container} /></>;
}
