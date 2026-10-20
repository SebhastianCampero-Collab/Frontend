import { useCallback } from 'react';
import { api } from '../api/client';
import { useAction, useResource } from './useResource';
/** Negotiates MCP and exposes tools/list plus project-scoped tools/call without fake IDs. */
export function useMcpTools(projectId: string) {
  const loader = useCallback((signal: AbortSignal) => api.listTools(signal), []);
  const catalog = useResource(loader, 'mcp-tools');
  const invocation = useAction<Awaited<ReturnType<typeof api.callTool>>>();
  const call = (name: string, args: Record<string, unknown>) => {
    if (!projectId) return Promise.reject(new Error('Selecciona un proyecto.'));
    return invocation.execute(() => api.callTool(name, args, projectId));
  };
  return { ...catalog, invocation, call };
}
