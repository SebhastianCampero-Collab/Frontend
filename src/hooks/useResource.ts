import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, message } from '../api/client';

/** Cancels reads and discards obsolete responses when the scope changes or unmounts. */
export function useResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  key: string,
  intervalMs = 0,
  enabled = true,
) {
  const reload = useRef<() => Promise<void>>(() => Promise.resolve());
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string | null;
    errorCode: string | null;
    loading: boolean;
    refreshStatus: 'idle' | 'updating' | 'updated' | 'unchanged' | 'error';
    updatedAt: number | null;
  }>({ key, data: null, error: null, errorCode: null, loading: enabled, refreshStatus: 'idle', updatedAt: null });
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let pending: Promise<void> = Promise.resolve();
    let busy = false;
    let manual = false;
    let previous: string | undefined;
    const controller = new AbortController();
    const load = (requested = false): Promise<void> => {
      if (disposed) return Promise.resolve();
      if (requested) {
        manual = true;
        setState((current) => ({ ...current, refreshStatus: 'updating' }));
      }
      if (busy) return pending;
      busy = true;
      setState((previous) => ({
        ...previous,
        key,
        data: previous.key === key ? previous.data : null,
        error: null,
        errorCode: null,
        loading: true,
        refreshStatus: previous.key === key ? previous.refreshStatus : 'idle',
        updatedAt: previous.key === key ? previous.updatedAt : null,
      }));
      pending = (async () => {
        try {
          const data = await loader(controller.signal);
          const serialized = JSON.stringify(data);
          const unchanged = previous !== undefined && previous === serialized;
          previous = serialized;
          const wasManual = manual;
          if (!disposed) setState((current) => ({ ...current, key, data, error: null, errorCode: null, loading: false,
            refreshStatus: wasManual ? unchanged ? 'unchanged' : 'updated' : current.refreshStatus,
            updatedAt: wasManual ? Date.now() : current.updatedAt }));
        } catch (error: unknown) {
          const wasManual = manual;
          if (!disposed) setState((current) => ({ ...current, key,
            data: current.key === key ? current.data : null, error: message(error), errorCode: error instanceof ApiError ? error.code : null, loading: false,
            refreshStatus: wasManual ? 'error' : current.refreshStatus }));
        } finally { busy = false; manual = false; }
      })();
      return pending;
    };
    const refresh = () => load(true);
    reload.current = refresh;
    void load();
    const timer = intervalMs
      ? setInterval(() => {
          if (!document.hidden) void load();
        }, intervalMs)
      : undefined;
    return () => {
      disposed = true;
      controller.abort();
      if (reload.current === refresh) reload.current = () => Promise.resolve();
      if (timer) clearInterval(timer);
    };
  }, [loader, key, intervalMs, enabled]);
  const refresh = useCallback(() => { void reload.current(); }, []);
  const reloadNow = useCallback(() => reload.current(), []);
  return {
    ...(enabled && state.key === key ? state : { key, data: null, error: null, errorCode: null, loading: enabled, refreshStatus: 'idle' as const, updatedAt: null }),
    refresh,
    reload: reloadNow,
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
