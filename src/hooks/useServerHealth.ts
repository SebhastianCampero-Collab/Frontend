import { useCallback } from 'react';
import { api } from '../api/client';
import { useResource } from './useResource';
/** Health is public, polled every 15 seconds and refreshed on demand. */
export function useServerHealth(intervalMs = 15000) {
  const loader = useCallback((signal: AbortSignal) => api.health(signal), []);
  const resource = useResource(loader, 'health', intervalMs);
  return {
    ...resource,
    connected:
      resource.error === null &&
      resource.data?.database.connected === true &&
      resource.data.status === 'ok',
  };
}
