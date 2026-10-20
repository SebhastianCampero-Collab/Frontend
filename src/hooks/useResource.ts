import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from '../api/client';

/** Cancels reads and discards obsolete responses when the scope changes or unmounts. */
export function useResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  key: string,
  intervalMs = 0,
  enabled = true,
) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string | null;
    loading: boolean;
  }>({ key, data: null, error: null, loading: enabled });
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let busy = false;
    const controller = new AbortController();
    const load = async () => {
      if (busy) return;
      busy = true;
      setState((previous) => ({
        key,
        data: previous.key === key ? previous.data : null,
        error: null,
        loading: true,
      }));
      try {
        const data = await loader(controller.signal);
        if (!disposed) setState({ key, data, error: null, loading: false });
      } catch (error: unknown) {
        if (!disposed)
          setState((previous) => ({
            key,
            data: previous.key === key ? previous.data : null,
            error: message(error),
            loading: false,
          }));
      } finally {
        busy = false;
      }
    };
    void load();
    const timer = intervalMs
      ? setInterval(() => {
          if (!document.hidden) void load();
        }, intervalMs)
      : undefined;
    return () => {
      disposed = true;
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [loader, key, intervalMs, enabled, revision]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return {
    ...(enabled && state.key === key ? state : { key, data: null, error: null, loading: enabled }),
    refresh,
  };
}

/** Mutations are never retried automatically; the synchronous lock prevents double clicks. */
export function useAction<T>() {
  const mounted = useRef(true);
  const locked = useRef(false);
  const [state, setState] = useState<{ data: T | null; error: string | null; pending: boolean }>({
    data: null,
    error: null,
    pending: false,
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const execute = useCallback(async (operation: () => Promise<T>): Promise<T> => {
    if (locked.current) throw new Error('Ya hay una operación en curso.');
    locked.current = true;
    if (mounted.current) setState({ data: null, error: null, pending: true });
    try {
      const data = await operation();
      if (mounted.current) setState({ data, error: null, pending: false });
      return data;
    } catch (error: unknown) {
      if (mounted.current) setState({ data: null, error: message(error), pending: false });
      throw error;
    } finally {
      locked.current = false;
    }
  }, []);
  const reset = useCallback(() => {
    if (!locked.current) setState({ data: null, error: null, pending: false });
  }, []);
  return { ...state, execute, reset };
}
